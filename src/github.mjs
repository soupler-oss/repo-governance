import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

export const ghAvailable = () => sh('gh', ['auth', 'status']).ok;

// Describes everything `--github` will do, so it can be shown (and confirmed) before any of it happens.
export function githubPlan(config, repo, dir) {
  const full = `${config.org.github}/${repo.name}`;
  return [
    `create ${config.org.visibility} repo ${full} (if it does not exist)`,
    `push initial commit to main and ${config.org.defaultBranch}`,
    `set GitHub's default branch to ${config.org.githubDefaultBranch}`,
    `apply rulesets from ${path.join(dir, '.github/governance/rulesets')}: ${rulesetFiles(dir).join(', ') || '(none found)'}`,
  ];
}

export function rulesetFiles(dir) {
  const d = path.join(dir, '.github/governance/rulesets');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort() : [];
}

// Private repos on a free GitHub plan cannot have rulesets at all (HTTP 403). That is a plan limit, not a bug in the
// payload, so say what it means instead of failing the whole publish.
export function isPlanLimit(text) {
  return /Upgrade to GitHub (Pro|Team)|make this repository public|HTTP 403/i.test(text ?? '');
}

export const PLAN_LIMIT_NOTICE = [
  '  ! Rulesets were NOT applied: GitHub does not allow them on private repositories on a free plan.',
  '    Until the plan is upgraded (GitHub Team/Pro) or the repo is public, branch protection is NOT enforced:',
  '    direct pushes to main/develop and force-pushes are possible, and required checks are not required.',
  '    Everything else still works: hooks, CI jobs and the PR/branch-policy workflows run. Apply later with `gov github <repo-dir>`.',
];

export function applyRulesets(config, repo, dir, log = console.log) {
  const full = `${config.org.github}/${repo.name}`;
  const existing = sh('gh', ['api', `repos/${full}/rulesets`]);
  if (!existing.ok && isPlanLimit(existing.err + existing.out)) { PLAN_LIMIT_NOTICE.forEach((l) => log(l)); return { applied: false, reason: 'plan-limit' }; }
  const byName = new Map(existing.ok ? JSON.parse(existing.out).map((r) => [r.name, r.id]) : []);
  for (const f of rulesetFiles(dir)) {
    const file = path.join(dir, '.github/governance/rulesets', f);
    const name = JSON.parse(fs.readFileSync(file, 'utf8')).name;
    const id = byName.get(name);
    const args = id
      ? ['api', '-X', 'PUT', `repos/${full}/rulesets/${id}`, '--input', file]
      : ['api', '-X', 'POST', `repos/${full}/rulesets`, '--input', file];
    const r = sh('gh', args);
    log(`  ${r.ok ? '✓' : '✗'} ruleset ${name} (${id ? 'updated' : 'created'})${r.ok ? '' : ' — ' + r.err}`);
    if (!r.ok) {
      if (isPlanLimit(r.err + r.out)) { PLAN_LIMIT_NOTICE.forEach((l) => log(l)); return { applied: false, reason: 'plan-limit' }; }
      throw new Error(`ruleset ${name} failed`);
    }
  }
  return { applied: true };
}

export function publishRepo(config, repo, dir, log = console.log) {
  const full = `${config.org.github}/${repo.name}`;
  const git = (...a) => sh('git', a, { cwd: dir });
  const exists = sh('gh', ['repo', 'view', full]).ok;
  if (!exists) {
    const r = sh('gh', ['repo', 'create', full, `--${config.org.visibility}`, '--description', repo.description || repo.name]);
    if (!r.ok) throw new Error(`gh repo create failed: ${r.err}`);
    log(`  ✓ created ${full}`);
  } else log(`  = ${full} already exists`);
  const remote = git('remote', 'get-url', 'origin');
  if (!remote.ok) git('remote', 'add', 'origin', `git@github.com:${full}.git`);
  // Never reset an integration branch that already has history: create it from main only if it does not exist.
  const hasBranch = (b) => git('rev-parse', '--verify', '--quiet', `refs/heads/${b}`).ok;
  if (!hasBranch(config.org.defaultBranch)) git('branch', config.org.defaultBranch, 'main');
  for (const b of ['main', config.org.defaultBranch]) {
    const p = git('push', '-u', 'origin', b);
    log(`  ${p.ok ? '✓' : '✗'} push ${b}${p.ok ? '' : ' — ' + p.err}`);
    if (!p.ok) throw new Error(`push ${b} failed`);
  }
  const d = sh('gh', ['repo', 'edit', full, '--default-branch', config.org.githubDefaultBranch]);
  log(`  ${d.ok ? '✓' : '✗'} default branch ${config.org.githubDefaultBranch}${d.ok ? '' : ' — ' + d.err}`);
  applyRulesets(config, repo, dir, log);
}
