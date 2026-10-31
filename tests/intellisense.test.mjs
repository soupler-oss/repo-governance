import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gov, tmp, walk } from './helpers.mjs';

// One package repo on its own: no doc layers anywhere, so nothing may point at L0 standards.
function packageOrg(features) {
  const dir = tmp();
  const cfg = path.join(dir, 'gov.json');
  fs.writeFileSync(cfg, JSON.stringify({
    org: { name: 'Acme' }, features, intellisense: { tracker: 'jira' },
    repos: [{ name: 'lib', profile: 'package' }],
  }));
  // PATH without an intellisense binary, so the test does not depend on what the machine has installed.
  const r = gov(['new-org', path.join(dir, 'org'), '--config', cfg], { env: { ...process.env, PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return { dir: path.join(dir, 'org', 'lib'), out: r.stdout };
}

test('features.intellisense adds the gate hook, the CI workflow and the required check', () => {
  const { dir, out } = packageOrg({ intellisense: true });
  const hook = fs.readFileSync(path.join(dir, '.githooks/pre-push'), 'utf8');
  assert.match(hook, /exec intellisense gate --pre-push/);
  assert.ok(fs.statSync(path.join(dir, '.githooks/pre-push')).mode & 0o111, 'hook is executable');
  assert.match(fs.readFileSync(path.join(dir, '.github/workflows/intellisense.yml'), 'utf8'), /soupler-oss\/intellisense@v3\.0\.0/);
  assert.match(fs.readFileSync(path.join(dir, '.github/governance/rulesets/main-develop-protection.json'), 'utf8'), /Intellisense Gate/);
  assert.match(fs.readFileSync(path.join(dir, 'bin/governance-brief.sh'), 'utf8'), /intellisense classify/);
  assert.match(out, /intellisense +not installed — finish with: .*--tracker jira/);
});

test('without the feature there is no intellisense file', () => {
  const { dir } = packageOrg({});
  assert.ok(!fs.existsSync(path.join(dir, '.githooks/pre-push')));
  assert.ok(!fs.existsSync(path.join(dir, '.github/workflows/intellisense.yml')));
  for (const f of walk(dir)) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /intellisense classify/, f);
});

test('a repo set with no L0 layer never points at standards that do not exist', () => {
  const { dir } = packageOrg({});
  for (const f of walk(dir)) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /L0-foundation`|standards: docs\/L0|\.\.\/lib\/docs\/L0/, f);
  }
  assert.match(fs.readFileSync(path.join(dir, 'bin/governance-brief.sh'), 'utf8'), /no documentation layers/);
});
