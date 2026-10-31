#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { normalizeConfig, loadConfig, listProfiles, TEMPLATE_VERSION } from '../src/config.mjs';
import { apply, readManifest, advisories } from '../src/stamp.mjs';
import { ghAvailable, githubPlan, publishRepo, applyRulesets } from '../src/github.mjs';

const HELP = `gov — Soupler governance generator (v${TEMPLATE_VERSION})

  gov create                   (aliases: generate, init)  Interactive: asks for org name, location, repos, options — then scaffolds.
  gov new-org <dir> --config governance.json [--github] [--yes] [--dry-run]
  gov new-org <dir> --name Example Org --owner "Example Org" --repos platform:product,site:site,assets:assets [--regulated]
        Create <dir>/<repo>/ for every repo: git init, full doc layers, hooks, workflows, rulesets, CLAUDE.md.
  gov add-repo <name> --profile <product|site|assets> [--org-dir .] [--description "..."]
        Add a repo to an existing org dir and refresh every sibling's topology section.
  gov adopt [dir] --config governance.json --repo <name> [--docs]
        Stamp governance into an EXISTING repo. Managed files only, unless --docs (also seeds docs/CLAUDE.md).
  gov sync [dir] [--config governance.json] [--check] [--dry-run] [--force]
        Pull template updates into a repo. Never overwrites a file you edited (writes <file>.governance-new).
  gov github [dir] [--yes] [--rulesets-only]
        Publish ONE repo: create it on GitHub if missing, push main + the integration branch, set the default
        branch, apply rulesets. Idempotent — safe on a repo you already pushed by hand.
  gov audit [dir]              Run the repo's own statutory-integrity gate.
  gov profiles                 List repo profiles.
  gov doctor                   Check node, git and gh.

Flags: --dry-run  show without writing   --yes  skip the confirmation before touching GitHub
`;

function parseArgs(argv) {
  const pos = []; const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[k] = true; else { flags[k] = next; i++; }
    } else pos.push(a);
  }
  return { pos, flags };
}

const log = console.log;
const summarize = (name, r) => {
  log(`\n${name}`);
  const line = (label, list) => list.length && log(`  ${label.padEnd(10)} ${list.length}${list.length <= 6 ? '  ' + list.join(', ') : ''}`);
  line('written', r.written); line('updated', r.updated); line('regions', r.regions);
  line('unchanged', r.unchanged); line('skipped', r.skipped);
  if (r.conflicts.length) {
    log(`  CONFLICTS  ${r.conflicts.length} — you edited these; review the .governance-new file next to each:`);
    r.conflicts.forEach((c) => log(`             ${c}`));
  }
};

function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

function initGit(dir, config) {
  if (!fs.existsSync(path.join(dir, '.git'))) git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'core.hooksPath', '.githooks');
  git(dir, 'add', '-A');
  // Commit as whoever is running this (their own git identity), never as a made-up author.
  const name = git(dir, 'config', 'user.name').out;
  const email = git(dir, 'config', 'user.email').out;
  const ident = name && email ? [] : ['-c', `user.name=${name || config.org.name}`, '-c', `user.email=${email || 'noreply@invalid.example'}`];
  git(dir, ...ident, 'commit', '-m', 'chore: init governance scaffold', '--no-verify');
  git(dir, 'branch', '-f', config.org.defaultBranch, 'main');
  // Leave the working tree on the integration branch: main is never worked on directly.
  git(dir, 'checkout', config.org.defaultBranch);
}

// With features.intellisense, the repo also gets intellisense's policy, rules and agent instructions. The pre-push hook
// and the CI workflow come from repo-governance (.githooks/pre-push, .github/workflows/intellisense.yml), so
// `intellisense init` runs without its own hook and workflow. Without the binary, say how to finish.
function intellisenseInit(dir, config, dryRun) {
  if (!config.features.intellisense || dryRun || fs.existsSync(path.join(dir, '.intellisense.yml'))) return;
  const which = spawnSync('intellisense', ['version'], { encoding: 'utf8' });
  const args = ['init', '--yes', '--no-hook', '--dir', dir, '--tracker', config.intellisense.tracker, '--agents', config.intellisense.agents.join(',')];
  if (which.status !== 0) {
    log(`  intellisense  not installed — finish with: brew install soupler-oss/tap/intellisense && intellisense ${args.join(' ')}`);
    return;
  }
  if (!fs.existsSync(path.join(dir, '.git'))) git(dir, 'init', '-b', 'main');
  const r = spawnSync('intellisense', args, { encoding: 'utf8' });
  log(r.status === 0 ? `  intellisense  set up (${which.stdout.trim()}; tracker: ${config.intellisense.tracker})` : `  intellisense  init failed:\n${r.stdout}${r.stderr}`);
}

async function confirm(question, yes) {
  if (yes) return true;
  if (!process.stdin.isTTY) { log(`${question}\n  (non-interactive: pass --yes to proceed)`); return false; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return a === 'y' || a === 'yes';
}

function configFromFlags(f) {
  if (f.config) return loadConfig(path.resolve(f.config));
  if (!f.name || !f.repos) throw new Error('Provide --config <file>, or --name and --repos name:profile,…');
  const repos = String(f.repos).split(',').map((s) => { const [name, profile] = s.split(':'); return { name, profile }; });
  return normalizeConfig({ org: { name: f.name, owner: f.owner, github: f.github, regulated: Boolean(f.regulated) }, repos });
}


async function runNewOrg(orgDir, config, flags) {
  const dryRun = Boolean(flags['dry-run']);
  log(`Org ${config.org.name} → ${orgDir}  (template v${TEMPLATE_VERSION}${dryRun ? ', dry run' : ''})`);
  if (!dryRun) { fs.mkdirSync(orgDir, { recursive: true }); fs.writeFileSync(path.join(orgDir, 'governance.json'), JSON.stringify(config, null, 2) + '\n'); }
  for (const repo of config.repos) {
    const dir = path.join(orgDir, repo.name);
    if (!dryRun) fs.mkdirSync(dir, { recursive: true });
    summarize(repo.name, apply(dir, config, repo, { mode: 'init', dryRun }));
    intellisenseInit(dir, config, dryRun);
    if (!dryRun) initGit(dir, config);
  }
  if (flags.github && !dryRun) {
    if (!ghAvailable()) throw new Error('gh is not authenticated — run `gh auth login`');
    log('\nGitHub actions that will run:');
    for (const repo of config.repos) githubPlan(config, repo, path.join(orgDir, repo.name)).forEach((l) => log(`  ${repo.name}: ${l}`));
    if (await confirm('\nThis creates repos and pushes to GitHub. Proceed?', flags.yes)) {
      for (const repo of config.repos) { log(`\n${repo.name}`); publishRepo(config, repo, path.join(orgDir, repo.name)); }
    } else log('Skipped GitHub. Re-run later with: gov github <repo-dir>');
  }
  log(`\nNext: cd ${orgDir}/<repo> && bash bin/install-hooks.sh && bash bin/statutory-integrity.sh`);
  log(`Then fill the TODOs in each repo's CLAUDE.md.${flags.github ? '' : ' Publish later with `gov github <repo-dir>`.'}`);
}

// Line-by-line prompting that works for a TTY and for piped input alike.
function makePrompter() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const it = rl[Symbol.asyncIterator]();
  const ask = async (q, def) => {
    process.stdout.write(`${q}${def !== undefined && def !== '' ? ` [${def}]` : ''}: `);
    const { value, done } = await it.next();
    if (done) { process.stdout.write('\n'); throw new Error('Input ended before all questions were answered'); }
    const v = String(value).trim();
    return v === '' ? (def ?? '') : v;
  };
  const yesNo = async (q, def = false) => /^y/i.test(await ask(`${q} (y/n)`, def ? 'y' : 'n'));
  return { ask, yesNo, close: () => rl.close() };
}

async function interactive() {
  const profiles = listProfiles();
  const p = makePrompter();
  try {
    log(`\nSoupler governance generator v${TEMPLATE_VERSION} — answer the questions; Enter accepts the [default].\n`);
    const name = await p.ask('Organisation / company name');
    if (!name) throw new Error('Organisation name is required');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const owner = await p.ask('Owner shown in document headers (company or team name)', name);
    const github = await p.ask('GitHub organisation/user that will own the repos', slug);
    const defaultDir = path.join(process.cwd(), slug);
    const dirAnswer = await p.ask('Folder to create everything in', defaultDir);
    const orgDir = path.resolve(dirAnswer.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
    const regulated = await p.yesNo('Regulated / audit-sensitive (adds L6 remediation, L6.1 execution, L7 forensics layers)?', false);
    const noAi = await p.yesNo('Block AI attribution (Co-Authored-By etc.) in commits and PRs?', true);
    const useIntellisense = await p.yesNo('Add the intellisense gate (risk tiers: Tier 1+ AI changes need a task and a contract, at push and in CI)?', true);
    const tracker = useIntellisense ? await p.ask('  task tracker for task references (none/github/jira/linear/beads)', 'github') : 'none';

    log('\nRepository types:');
    for (const pr of profiles) log(`  ${pr.name.padEnd(8)} ${pr.role}`);
    const repos = [];
    log('\nAdd repositories (blank name to finish).');
    for (;;) {
      const rn = await p.ask(`Repo #${repos.length + 1} name (kebab-case)`, repos.length ? '' : 'platform');
      if (!rn) break;
      const profile = await p.ask(`  type [${profiles.map((x) => x.name).join('/')}]`, repos.length ? 'site' : 'product');
      const description = await p.ask('  one-line description', '');
      const follows = await p.ask('  follows which repos? (comma-separated names it must stay in sync with, or blank)', '');
      const owns = await p.ask('  is the source of truth for? (comma-separated, or blank)', '');
      repos.push({ name: rn, profile, description, follows: follows.split(',').map((x) => x.trim()).filter(Boolean), owns: owns.split(',').map((x) => x.trim()).filter(Boolean) });
      if (!(await p.yesNo('Add another repository?', true))) break;
    }
    const firstProduct = repos.find((r) => r.profile === 'product')?.name ?? repos[0]?.name;
    const standardsRepo = repos.length > 1 ? await p.ask('Which repo holds the org-wide L0 standards?', firstProduct) : firstProduct;
    const pm = await p.ask('Package manager (pnpm/npm/yarn)', 'pnpm');
    const node = await p.ask('Node version', '22.15.0');
    const orgGithub = await p.yesNo('Create the repos on GitHub and apply branch rulesets now? (asks again before touching GitHub)', false);

    const config = normalizeConfig({
      org: { name, owner, github, regulated, standardsRepo },
      rules: { noAiAttribution: noAi },
      features: { intellisense: useIntellisense },
      intellisense: { tracker },
      stack: { packageManager: pm, node },
      commands: pm === 'pnpm' ? {} : { install: `${pm} install`, lint: `${pm} run lint`, typeCheck: `${pm} run type-check`, test: `${pm} test` },
      repos,
    });
    log('\n── Summary ─────────────────────────────────────────');
    log(`  Org        ${name} (GitHub: ${github})`);
    log(`  Location   ${orgDir}`);
    log(`  Layers     ${regulated ? 'regulated (L6/L6.1/L7 included)' : 'standard'}`);
    for (const r of config.repos) log(`  Repo       ${r.name}  [${r.profile}]${r.name === standardsRepo ? '  (holds L0 standards)' : ''}`);
    log(`  Gate       ${useIntellisense ? `intellisense (tracker: ${tracker})` : 'none'}`);
    log(`  GitHub     ${orgGithub ? 'create repos + rulesets (will confirm)' : 'not now'}`);
    if (!(await p.yesNo('\nCreate this now?', true))) throw new Error('Cancelled — nothing was written');
    return { orgDir, config, github: orgGithub };
  } finally { p.close(); }
}

async function main() {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const [cmd, ...rest] = pos;
  const dryRun = Boolean(flags['dry-run']);

  switch (cmd) {
    case 'new-org': {
      await runNewOrg(path.resolve(rest[0] ?? '.'), configFromFlags(flags), flags);
      break;
    }
    case 'create': case 'generate': case 'init': {
      const { orgDir, config, github } = await interactive();
      await runNewOrg(orgDir, config, { ...flags, github: github || flags.github });
      break;
    }
    case 'add-repo': {
      const orgDir = path.resolve(flags['org-dir'] ?? '.');
      const cfgFile = path.join(orgDir, 'governance.json');
      if (!fs.existsSync(cfgFile)) throw new Error(`No governance.json in ${orgDir}`);
      const raw = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      const [name] = rest;
      if (!name || !flags.profile) throw new Error('Usage: gov add-repo <name> --profile <profile>');
      raw.repos.push({ name, profile: flags.profile, description: flags.description ?? '' });
      const config = normalizeConfig(raw);
      fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2) + '\n');
      for (const repo of config.repos) {
        const dir = path.join(orgDir, repo.name);
        const isNew = repo.name === name;
        if (isNew) fs.mkdirSync(dir, { recursive: true });
        else if (!fs.existsSync(dir)) continue;
        summarize(repo.name, apply(dir, config, repo, { mode: isNew ? 'init' : 'sync', dryRun }));
        if (isNew) intellisenseInit(dir, config, dryRun);
        if (isNew && !dryRun) initGit(dir, config);
      }
      break;
    }
    case 'adopt': {
      const dir = path.resolve(rest[0] ?? '.');
      const config = configFromFlags(flags);
      const repo = config.repos.find((r) => r.name === flags.repo);
      if (!repo) throw new Error(`--repo must be one of: ${config.repos.map((r) => r.name).join(', ')}`);
      summarize(repo.name, apply(dir, config, repo, { mode: 'adopt', docs: Boolean(flags.docs), dryRun }));
      intellisenseInit(dir, config, dryRun);
      if (!flags.docs) log('\n(managed files only — pass --docs to also seed CLAUDE.md, README, CHANGELOG, doc layers)');
      break;
    }
    case 'sync': {
      const dir = path.resolve(rest[0] ?? '.');
      if (!fs.existsSync(dir)) throw new Error(`Folder does not exist: ${dir}\n  (note: ~ already means your home folder, so use ~/Documents/…, not ~/Users/…)`);
      const m = readManifest(dir);
      if (!m) throw new Error(`${dir} has no .governance/manifest.json — it was not generated by gov. Use \`gov adopt\` to add governance to an existing repo.`);
      if (flags.config) m.config = loadConfig(path.resolve(flags.config));   // adopt updated org config (e.g. who owns what)
      const repo = m.config.repos.find((r) => r.name === m.repo);
      if (!repo) throw new Error(`Repo "${m.repo}" is not in the supplied config`);
      const check = Boolean(flags.check);
      const r = apply(dir, m.config, repo, { mode: 'sync', dryRun: dryRun || check, force: Boolean(flags.force) });
      summarize(`${m.repo} (from template v${m.templateVersion} → v${TEMPLATE_VERSION})`, r);
      if (!check) intellisenseInit(dir, m.config, dryRun);
      for (const a of advisories(dir, m.config, repo)) log(`  ADVISORY   ${a.file}: template has ${a.template}, you have ${a.local} — review the template copy`);
      if (check && (r.written.length || r.updated.length || r.regions.length || r.conflicts.length)) { log('\ngovernance drift detected'); process.exitCode = 1; }
      break;
    }
    case 'github': {
      const dir = path.resolve(rest[0] ?? '.');
      if (!fs.existsSync(dir)) throw new Error(`Folder does not exist: ${dir}`);
      const m = readManifest(dir);
      if (!m) throw new Error('Not a governed repo (no manifest)');
      const repo = m.config.repos.find((r) => r.name === m.repo);
      const rulesetsOnly = Boolean(flags['rulesets-only']);
      if (rulesetsOnly) log(`  apply rulesets from ${path.join(dir, '.github/governance/rulesets')}`);
      else githubPlan(m.config, repo, dir).forEach((l) => log(`  ${l}`));
      if (dryRun || !(await confirm(rulesetsOnly ? 'Apply rulesets to GitHub?' : 'Publish this repo to GitHub as described above?', flags.yes))) break;
      if (!ghAvailable()) throw new Error('gh is not authenticated — run `gh auth login`');
      if (rulesetsOnly) applyRulesets(m.config, repo, dir); else publishRepo(m.config, repo, dir);
      break;
    }
    case 'audit': {
      const dir = path.resolve(rest[0] ?? '.');
      const r = spawnSync('bash', ['bin/statutory-integrity.sh'], { cwd: dir, stdio: 'inherit' });
      process.exitCode = r.status ?? 1;
      break;
    }
    case 'profiles':
      for (const p of listProfiles()) log(`  ${p.name.padEnd(10)} ${p.role} — layers: ${p.layers.join(', ') || '(none)'}`);
      break;
    case 'doctor': {
      for (const [n, c, a] of [['node', 'node', ['-v']], ['git', 'git', ['--version']], ['gh', 'gh', ['--version']]]) {
        const r = spawnSync(c, a, { encoding: 'utf8' });
        log(`  ${r.status === 0 ? '✓' : '✗'} ${n} ${r.status === 0 ? r.stdout.split('\n')[0] : 'missing'}`);
      }
      log(`  ${ghAvailable() ? '✓' : '✗'} gh authenticated`);
      break;
    }
    default:
      log(HELP);
      if (cmd && cmd !== 'help') process.exitCode = 1;
  }
}

main().catch((e) => { console.error(`gov: ${e.message}`); process.exit(1); });
