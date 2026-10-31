import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newOrg, gov, sh } from './helpers.mjs';

test('sync is idempotent on a fresh repo and --check exits 0', () => {
  const repo = path.join(newOrg(), 'platform');
  const r = gov(['sync', repo, '--check']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('sync restores a managed file nobody intentionally changed? no — local edits are never clobbered', () => {
  const repo = path.join(newOrg(), 'platform');
  const f = path.join(repo, '.github/workflows/branch-policy.yml');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8') + '\n# local tweak\n');
  const r = gov(['sync', repo]);
  assert.match(r.stdout, /CONFLICTS/);
  assert.match(fs.readFileSync(f, 'utf8'), /local tweak/);
  assert.ok(fs.existsSync(`${f}.governance-new`));
  assert.equal(gov(['sync', repo, '--check']).status, 1);
});

test('sync --force overwrites a locally edited managed file', () => {
  const repo = path.join(newOrg(), 'platform');
  const f = path.join(repo, 'bin/run-gitleaks.sh');
  fs.writeFileSync(f, '# broken\n');
  gov(['sync', repo, '--force']);
  assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /# broken/);
});

test('sync updates an untouched managed file when the template moves on', () => {
  const org = newOrg();
  const repo = path.join(org, 'platform');
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.governance/manifest.json'), 'utf8'));
  m.config.rules.releasePrTitle = 'ship';
  fs.writeFileSync(path.join(repo, '.governance/manifest.json'), JSON.stringify(m));
  const r = gov(['sync', repo]);
  assert.match(r.stdout, /updated/);
  assert.match(fs.readFileSync(path.join(repo, '.github/workflows/pr-governance.yml'), 'utf8'), /'\^ship/);
});

test('seeded files are never overwritten, but region spans refresh', () => {
  const org = newOrg();
  const repo = path.join(org, 'platform');
  const f = path.join(repo, 'CLAUDE.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('TODO — what this product does', 'OUR PRODUCT DOES X'));
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.governance/manifest.json'), 'utf8'));
  m.config.repos.push({ name: 'mobile-kit', profile: 'package', description: 'Shared kit', owns: [], follows: [] });
  fs.writeFileSync(path.join(repo, '.governance/manifest.json'), JSON.stringify(m));
  gov(['sync', repo]);
  const t = fs.readFileSync(f, 'utf8');
  assert.match(t, /OUR PRODUCT DOES X/);
  assert.match(t, /`mobile-kit`/);
});

test('add-repo creates the repo and refreshes every sibling topology', () => {
  const org = newOrg();
  const r = gov(['add-repo', 'shared-content', '--profile', 'package', '--org-dir', org, '--description', 'Shared copy']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(org, 'shared-content/CLAUDE.md')));
  for (const repo of ['platform', 'website', 'assets']) assert.match(fs.readFileSync(path.join(org, repo, 'CLAUDE.md'), 'utf8'), /shared-content/);
  assert.match(fs.readFileSync(path.join(org, 'platform/docs/L0-foundation/L0-010-org-repo-topology-v1.md'), 'utf8'), /shared-content/);
  assert.equal(sh('bash', ['bin/statutory-integrity.sh'], { cwd: path.join(org, 'platform') }).status, 0);
});

test('adopt on an existing repo writes managed files only and never touches existing docs', () => {
  const org = newOrg();
  const existing = path.join(org, '..', `existing-${Date.now()}`);
  fs.mkdirSync(path.join(existing, 'docs/L0-foundation'), { recursive: true });
  fs.writeFileSync(path.join(existing, 'CLAUDE.md'), 'MY CLAUDE\n');
  fs.writeFileSync(path.join(existing, 'README.md'), 'readme\n');
  const r = gov(['adopt', existing, '--config', path.join(org, 'governance.json'), '--repo', 'platform']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(existing, 'CLAUDE.md'), 'utf8'), 'MY CLAUDE\n');
  assert.ok(fs.existsSync(path.join(existing, 'bin/statutory-integrity.mjs')));
  assert.ok(!fs.existsSync(path.join(existing, 'docs/L2-product')), 'no doc layers without --docs');
});

test('invalid configs are rejected with a clear message', () => {
  const dir = fs.mkdtempSync(path.join(newOrg(), '..', 'bad-'));
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ org: { name: 'X' }, repos: [{ name: 'A_b', profile: 'nope' }, { name: 'ok', profile: 'site', follows: ['ghost'] }] }));
  const r = gov(['new-org', path.join(dir, 'o'), '--config', bad]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /kebab-case/);
  assert.match(r.stderr, /Unknown profile "nope"/);
  assert.match(r.stderr, /follows unknown repo "ghost"/);
});

test('gov create asks the questions and scaffolds a passing org', () => {
  const dir = fs.mkdtempSync(path.join(newOrg(), '..', 'create-'));
  const out = path.join(dir, 'zed');
  const answers = ['Zed Labs', '', '', out, 'n', 'y', 'n', 'core', 'product', 'The product', '', 'brand tokens', 'y', 'web', 'site', 'Website', 'core', '', 'n', '', '', '', 'n', 'y'].join('\n') + '\n';
  const r = sh('node', [path.join(path.dirname(new URL(import.meta.url).pathname), '../bin/gov.mjs'), 'create'], { input: answers });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(out, 'governance.json')));
  assert.match(fs.readFileSync(path.join(out, 'web/CLAUDE.md'), 'utf8'), /follows that one/);
  assert.equal(sh('bash', ['bin/statutory-integrity.sh'], { cwd: path.join(out, 'core') }).status, 0);
});

test('gov create aborts cleanly when the user declines', () => {
  const dir = fs.mkdtempSync(path.join(newOrg(), '..', 'create-'));
  const out = path.join(dir, 'nope');
  const answers = ['Zed', '', '', out, 'n', 'y', 'n', 'core', 'product', '', '', '', 'n', 'n', 'pnpm', '22.15.0', 'n', 'n'].join('\n') + '\n';
  const r = sh('node', [path.join(path.dirname(new URL(import.meta.url).pathname), '../bin/gov.mjs'), 'create'], { input: answers });
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(out));
});

test('sync on a folder that does not exist says so, instead of blaming the manifest', () => {
  const r = gov(['sync', '/nonexistent/path/xyz']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Folder does not exist/);
});

test('every shipped workflow except the ci.yml seed is managed, so sync can repair it', () => {
  const repo = path.join(newOrg(), 'platform');
  const m = JSON.parse(fs.readFileSync(path.join(repo, '.governance/manifest.json'), 'utf8'));
  for (const f of fs.readdirSync(path.join(repo, '.github/workflows'))) {
    if (f === 'ci.yml') continue;
    assert.ok(m.files[`.github/workflows/${f}`], `${f} is not tracked as managed`);
  }
});

test('a GitHub free-plan ruleset rejection is recognised as a plan limit, not a failure', async () => {
  const { isPlanLimit } = await import('../src/github.mjs');
  assert.ok(isPlanLimit('gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)'));
  assert.ok(!isPlanLimit('HTTP 422: Validation Failed'));
});

test('sync --config adopts changed ownership and refreshes the sibling sections', () => {
  const org = newOrg();
  const cfg = JSON.parse(fs.readFileSync(path.join(org, 'governance.json'), 'utf8'));
  cfg.repos.find((r) => r.name === 'assets').owns = ['the logo and brand palette'];
  const f = path.join(org, 'new.json');
  fs.writeFileSync(f, JSON.stringify(cfg));
  const r = gov(['sync', path.join(org, 'platform'), '--config', f]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(org, 'platform/CLAUDE.md'), 'utf8'), /follows that one for the logo and brand palette, not the reverse/);
});

test('an assets repo owns the brand by default, so followers are told to take the brand from it', () => {
  const org = newOrg();
  assert.match(fs.readFileSync(path.join(org, 'website/CLAUDE.md'), 'utf8'), /`assets`.*Owns: logos, brand palette/);
});
