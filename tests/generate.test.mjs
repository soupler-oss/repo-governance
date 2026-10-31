import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newOrg, walk, sh, gov, example, tmp } from './helpers.mjs';

const org = newOrg();
const read = (...p) => fs.readFileSync(path.join(org, ...p), 'utf8');

test('every generated repo passes its own statutory-integrity gate', () => {
  for (const r of ['platform', 'website', 'assets']) {
    const res = sh('bash', ['bin/statutory-integrity.sh'], { cwd: path.join(org, r) });
    assert.equal(res.status, 0, `${r}: ${res.stdout}${res.stderr}`);
  }
});

test('no unrendered template tokens survive anywhere', () => {
  for (const f of walk(org)) {
    const t = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(t, /@@[#/]?[a-z]/i, `${f} still contains @@ tokens`);
  }
});

test('product repo has the layers, L0 standards, and agent files', () => {
  for (const p of ['docs/L0-foundation/L0-006-change-propagation-governance-v1.md', 'docs/L0-foundation/L0-009-engineering-principles-v1.md',
    'docs/L3-architecture/L3-000-artifact-registry-v1.md', 'CLAUDE.md', '.claude/skills/doc-governance/SKILL.md', '.claude/settings.json',
    '.githooks/commit-msg', '.github/workflows/branch-policy.yml', '.github/governance/rulesets/main-protection.json']) {
    assert.ok(fs.existsSync(path.join(org, 'platform', p)), p);
  }
  assert.ok(!fs.existsSync(path.join(org, 'platform/docs/L6-remediation')), 'unregulated org gets no L6');
});

test('non-standards repos point at the standards repo instead of copying L0', () => {
  assert.ok(!fs.existsSync(path.join(org, 'website/docs/L0-foundation')));
  assert.match(read('website/CLAUDE.md'), /\.\.\/platform\/docs\/L0-foundation/);
});

test('CLAUDE.md states the governance contract and names siblings', () => {
  const c = read('platform/CLAUDE.md');
  assert.match(c, /Golden Rule/);
  assert.match(c, /Doc-first/i);
  assert.match(c, /bin\/statutory-integrity\.sh/);
  assert.match(c, /`website`/);
  const assetsMd = read('assets/CLAUDE.md');
  assert.match(assetsMd, /source of truth\*\* for the brand identity/);
  assert.match(assetsMd, /brand change is made \*\*here first\*\*/);
  assert.doesNotMatch(assetsMd, /never leads|copied from the owning repo/);
  assert.match(read('platform/CLAUDE.md'), /`assets`.*Owns: logos, brand palette/);
});

test('rulesets are valid JSON and require every profile check', () => {
  const r = JSON.parse(read('platform/.github/governance/rulesets/main-protection.json'));
  const checks = r.rules.find((x) => x.type === 'required_status_checks').parameters.required_status_checks.map((c) => c.context);
  for (const c of ['Statutory Integrity', 'PR Metadata', 'Quality Checks', 'Tests', 'Secret Scan', 'Branch Policy']) assert.ok(checks.includes(c), c);
  const a = JSON.parse(read('assets/.github/governance/rulesets/main-develop-protection.json'));
  const ac = a.rules.find((x) => x.type === 'required_status_checks').parameters.required_status_checks.map((c) => c.context);
  assert.ok(!ac.includes('Tests'));
});

test('workflow job names equal the required check names', () => {
  const names = new Set();
  for (const f of walk(path.join(org, 'platform/.github/workflows'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/^\s{4}name: (.+)$/gm)) names.add(m[1].trim());
  for (const c of ['Statutory Integrity', 'PR Metadata', 'Quality Checks', 'Tests', 'Secret Scan', 'Branch Policy']) assert.ok(names.has(c), `no workflow job named "${c}"`);
});

test('the template contains no individual or company-specific examples', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const self = new Set([import.meta.url.replace('file://', '')]);
  for (const f of walk(root)) {
    if (self.has(f) || f.includes('/node_modules/')) continue;
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /srivastava|sunny|galiaraa|vedalogix|veda logix|PinGLogo|meridian/i, f);
  }
});

test('a regulated org with a renamed layer folder and a shared package generates and passes its gates', () => {
  const dir = tmp();
  const cfg = path.join(dir, 'c.json');
  fs.writeFileSync(cfg, JSON.stringify({
    org: { name: 'Example Org', regulated: true, standardsRepo: 'core' },
    layerFolders: { L3: 'L3-engineering' },
    repos: [
      { name: 'core', profile: 'product', owns: ['brand tokens'] },
      { name: 'web', profile: 'site', follows: ['core', 'content'] },
      { name: 'media', profile: 'assets', follows: ['core'] },
      { name: 'content', profile: 'package', owns: ['shared copy'] },
    ],
  }));
  const r = gov(['new-org', path.join(dir, 'o'), '--config', cfg]);
  assert.equal(r.status, 0, r.stderr);
  const o = path.join(dir, 'o');
  for (const repo of ['core', 'web', 'media', 'content']) assert.ok(fs.existsSync(path.join(o, repo, 'CLAUDE.md')), repo);
  assert.ok(fs.existsSync(path.join(o, 'core/docs/L3-engineering/L3-000-artifact-registry-v1.md')));
  assert.ok(fs.existsSync(path.join(o, 'core/docs/L7-forensics/L7-001-master-registry-v1.md')));
  const c = fs.readFileSync(path.join(o, 'core/CLAUDE.md'), 'utf8');
  assert.match(c, /L6 \/ L6\.1 \/ L7/);
  assert.match(c, /source of truth for:\*\* brand tokens/);
  for (const repo of ['core', 'web']) assert.equal(sh('bash', ['bin/statutory-integrity.sh'], { cwd: path.join(o, repo) }).status, 0, repo);
});

test('personal-account owners get a repository-admin bypass and owner-only review in the rulesets', () => {
  const dir = tmp();
  const cfg = path.join(dir, 'c.json');
  fs.writeFileSync(cfg, JSON.stringify({ org: { name: 'Solo', bypass: 'repository-admin', codeowners: '@solo', requiredReviews: 1 }, repos: [{ name: 'app', profile: 'product' }] }));
  assert.equal(gov(['new-org', path.join(dir, 'o'), '--config', cfg]).status, 0);
  const r = JSON.parse(fs.readFileSync(path.join(dir, 'o/app/.github/governance/rulesets/main-protection.json'), 'utf8'));
  assert.deepEqual(r.bypass_actors, [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' }]);
  const pr = r.rules.find((x) => x.type === 'pull_request').parameters;
  assert.equal(pr.require_code_owner_review, true);
  assert.equal(pr.required_approving_review_count, 1);
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ org: { name: 'X', bypass: 'everyone' }, repos: [{ name: 'a', profile: 'site' }] }));
  assert.match(gov(['new-org', path.join(dir, 'p'), '--config', bad]).stderr, /org\.bypass must be/);
});

test('assets repos are scaffolded with the numbered category tree, named after the org', () => {
  const o = newOrg();
  const base = path.join(o, 'assets', 'example-org-assets');
  for (const d of ['01-brand/logos/svg', '01-brand/logos/png', '02-social-media/instagram', '02-social-media/linkedin', '02-social-media/youtube',
    '03-app-store/listing/source', '03-app-store/listing/iphone', '03-app-store/listing/ipad', '04-documents']) {
    assert.ok(fs.existsSync(path.join(base, d)), d);
  }
  for (const f of ['rendering/src/generate-logo-variants.mjs', 'rendering/src/render-svgs.mjs', 'package.json']) assert.ok(fs.existsSync(path.join(o, 'assets', f)), f);
  assert.equal(JSON.parse(fs.readFileSync(path.join(o, 'assets/package.json'), 'utf8')).name, '@example-org/assets');
  assert.equal(JSON.parse(fs.readFileSync(path.join(o, 'assets/package.json'), 'utf8')).packageManager, 'pnpm@9.15.9');
  assert.match(fs.readFileSync(path.join(o, 'assets/README.md'), 'utf8'), /source of truth for Example Org's brand/);
});

test('the generated logo script derives mono variants and a square favicon from the primary SVGs', () => {
  const o = newOrg();
  const svgDir = path.join(o, 'assets/example-org-assets/01-brand/logos/svg');
  const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><title id="t">t</title><g transform="translate(0 0)"><path fill="#033561" d="M0 0h10v10z"/></g></svg>\n`;
  fs.writeFileSync(path.join(svgDir, 'example-org-logo-full-primary.svg'), svg(200, 100));
  fs.writeFileSync(path.join(svgDir, 'example-org-logo-mark-primary.svg'), svg(100, 60));
  const r = sh('node', ['rendering/src/generate-logo-variants.mjs'], { cwd: path.join(o, 'assets') });
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(svgDir, 'example-org-logo-full-mono-white.svg'), 'utf8'), /fill="#ffffff"/);
  assert.match(fs.readFileSync(path.join(svgDir, 'example-org-logo-mark-mono-black.svg'), 'utf8'), /fill="#000000"/);
  assert.match(fs.readFileSync(path.join(svgDir, 'favicon.svg'), 'utf8'), /viewBox="0 0 100 100"/);
});

test('PR Metadata exempts Dependabot PRs from the Docs update block, and only them', () => {
  // The run script of the generated `metadata` job, executed as CI would run it.
  const wf = read('platform/.github/workflows/pr-governance.yml');
  const block = wf.slice(wf.indexOf('name: Validate title and body'));
  const run = block.slice(block.indexOf('run: |') + 'run: |'.length).split('\n').slice(1)
    .map((l) => l.replace(/^ {10}/, '')).join('\n');
  const check = (author, title, body) => sh('bash', ['-c', run], {
    env: { ...process.env, PR_AUTHOR: author, PR_TITLE: title, PR_BODY: body, HEAD_REF: 'feat/x', BASE_REF: 'develop' },
  });
  const bump = 'Bumps a dependency from 1.0.0 to 1.0.1.';
  assert.equal(check('dependabot[bot]', 'chore(deps): bump a dependency', bump).status, 0, 'Dependabot PR without the block should pass');
  assert.equal(check('a-person', 'chore(deps): bump a dependency', bump).status, 1, 'a person still needs the block');
  assert.equal(check('dependabot[bot]', 'bump a dependency', bump).status, 1, 'Dependabot titles are still checked');
  assert.equal(check('a-person', 'feat(x): y', '## Docs update\n- Status: `EXEMPT`\n- Notes: comment-only change').status, 0);
});

test('a repo that opts into layers gets their starter docs, whatever its profile', () => {
  const cfg = JSON.parse(fs.readFileSync(example('new-org.governance.json'), 'utf8'));
  cfg.repos = [{ name: 'tool', profile: 'package', description: 'A tool.', layers: ['L0', 'L2', 'L3', 'L4', 'L6', 'L6.1', 'L7'] }];
  const dir = tmp();
  const file = path.join(dir, 'governance.json');
  fs.writeFileSync(file, JSON.stringify(cfg));
  const r = gov(['new-org', path.join(dir, 'org'), '--config', file]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const repo = path.join(dir, 'org', 'tool');
  for (const p of ['docs/L0-foundation/L0-001-master-document-template-v1.md', 'docs/L2-product/L2-000-artifact-registry-v1.md',
    'docs/L3-architecture/L3-001-system-architecture-v1.md', 'docs/L4-infrastructure/L4-001-local-dev-setup-v1.md',
    'docs/L6-remediation/L6-001-remediation-protocol-v1.md', 'docs/L6.1-remediation-execution/L6.1-000-artifact-registry-v1.md',
    'docs/L7-forensics/L7-001-master-registry-v1.md']) {
    assert.ok(fs.existsSync(path.join(repo, p)), p);
  }
  assert.ok(!fs.existsSync(path.join(repo, 'docs/L5-operations')), 'no starter docs for a layer it did not choose');
  const gate = sh('bash', ['bin/statutory-integrity.sh'], { cwd: repo });
  assert.equal(gate.status, 0, gate.stdout + gate.stderr);
});

test('GitHub shows main by default; work still targets develop', async () => {
  const { normalizeConfig } = await import('../src/config.mjs');
  const { githubPlan } = await import('../src/github.mjs');
  const cfg = JSON.parse(fs.readFileSync(example('new-org.governance.json'), 'utf8'));
  const config = normalizeConfig(cfg);
  assert.equal(config.org.defaultBranch, 'develop');
  assert.equal(config.org.githubDefaultBranch, 'main');
  const plan = githubPlan(config, config.repos[0], tmp()).join('\n');
  assert.match(plan, /push initial commit to main and develop/);
  assert.match(plan, /set GitHub's default branch to main/);
  assert.match(read('platform/.github/PROTECTION_GUIDE.md'), /GitHub's default branch is\n`main`; pull requests target `develop`/);
  assert.throws(() => normalizeConfig({ ...cfg, org: { ...cfg.org, defaultBranch: 'trunk' } }), /defaultBranch must be "develop"/);
  assert.throws(() => normalizeConfig({ ...cfg, org: { ...cfg.org, githubDefaultBranch: 'release' } }), /githubDefaultBranch must be main or develop/);
  assert.equal(normalizeConfig({ ...cfg, org: { ...cfg.org, githubDefaultBranch: 'develop' } }).org.githubDefaultBranch, 'develop');
});
