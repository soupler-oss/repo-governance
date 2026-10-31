import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYERS, LAYER_BY_CODE, layerKey } from './layers.mjs';

export const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE_VERSION = JSON.parse(fs.readFileSync(path.join(TEMPLATE_ROOT, 'package.json'), 'utf8')).version;

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function listProfiles() {
  const dir = path.join(TEMPLATE_ROOT, 'profiles');
  return fs.readdirSync(dir)
    .filter((n) => !n.startsWith('_') && fs.existsSync(path.join(dir, n, 'profile.json')))
    .map((n) => ({ name: n, ...readProfile(n) }));
}

export function readProfile(name) {
  const file = path.join(TEMPLATE_ROOT, 'profiles', name, 'profile.json');
  if (!fs.existsSync(file)) throw new Error(`Unknown profile "${name}". Available: ${listProfilesSafe().join(', ')}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listProfilesSafe() {
  const dir = path.join(TEMPLATE_ROOT, 'profiles');
  return fs.readdirSync(dir).filter((n) => !n.startsWith('_'));
}

// Fills defaults and rejects configs that would generate something inconsistent.
export function normalizeConfig(raw) {
  const errs = [];
  const org = { ...raw.org };
  if (!org.name) errs.push('org.name is required');
  org.slug ??= (org.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  org.github ??= org.name;
  org.owner ??= org.name;
  org.copyright ??= org.name;
  org.license ??= 'Proprietary';
  org.codeowners ??= '';
  // The integration branch every PR targets. The generated rulesets, workflows and docs protect and name `develop`.
  org.defaultBranch ??= 'develop';
  if (org.defaultBranch !== 'develop') errs.push(`org.defaultBranch must be "develop": the generated rulesets, workflows and docs protect and target develop (got "${org.defaultBranch}")`);
  // The branch GitHub shows first. `main` holds the released version, so visitors see what users get.
  org.githubDefaultBranch ??= 'main';
  if (![org.defaultBranch, 'main'].includes(org.githubDefaultBranch)) errs.push(`org.githubDefaultBranch must be main or ${org.defaultBranch} (got "${org.githubDefaultBranch}")`);
  org.regulated ??= false;
  org.visibility ??= 'private';
  // Who may bypass the PR rules (still only via a pull request, never a direct push). Personal GitHub accounts have no
  // 'organization admin', so they use 'repository-admin'.
  org.bypass ??= 'organization-admin';
  if (!['organization-admin', 'repository-admin'].includes(org.bypass)) errs.push(`org.bypass must be organization-admin or repository-admin (got "${org.bypass}")`);

  const rules = { noAiAttribution: true, releasePrTitle: 'release', requireDocsUpdate: true, ...raw.rules };
  const commands = { install: 'pnpm install --frozen-lockfile', lint: 'pnpm lint', typeCheck: 'pnpm type-check', test: 'pnpm test', ...raw.commands };
  const stack = { packageManager: 'pnpm', node: '22.15.0', pnpm: '9.15.9', ...raw.stack };
  stack.isPnpm = stack.packageManager === 'pnpm';
  const features = { docsSite: false, intellisense: false, ...raw.features };
  // intellisense is the AI-change risk gate: repo-governance installs and keeps it current when features.intellisense is on.
  const intellisense = { version: '3.0.0', tracker: 'github', agents: ['claude', 'codex', 'copilot', 'cursor'], ...raw.intellisense };
  if (!/^\d+\.\d+\.\d+$/.test(intellisense.version)) errs.push(`intellisense.version must be a release such as 2.1.0 (got "${intellisense.version}")`);
  if (!['none', 'beads', 'github', 'jira', 'linear'].includes(intellisense.tracker)) errs.push(`intellisense.tracker must be none, beads, github, jira or linear (got "${intellisense.tracker}")`);
  if (!Array.isArray(intellisense.agents)) errs.push('intellisense.agents must be a list');
  const layerFolders = { ...raw.layerFolders };

  const repos = (raw.repos ?? []).map((r) => {
    const base = { description: '', owns: [], follows: [], ...r };
    // A profile can declare what its repos own by default (e.g. the assets repo owns the brand).
    if (base.owns.length === 0) { try { base.owns = readProfile(base.profile).defaultOwns ?? []; } catch { /* reported below */ } }
    return base;
  });
  if (repos.length === 0) errs.push('at least one repo is required');
  const seen = new Set();
  for (const r of repos) {
    if (!SLUG.test(r.name ?? '')) errs.push(`repo name "${r.name}" must be lowercase kebab-case`);
    if (seen.has(r.name)) errs.push(`duplicate repo "${r.name}"`);
    seen.add(r.name);
    try { readProfile(r.profile); } catch (e) { errs.push(`repo "${r.name}": ${e.message}`); }
  }
  for (const r of repos) {
    for (const f of r.follows) if (!seen.has(f)) errs.push(`repo "${r.name}" follows unknown repo "${f}"`);
  }
  // Layer-zero standards live in exactly one repo; every other repo points at it.
  org.standardsRepo ??= repos.find((r) => r.profile === 'product')?.name ?? repos[0]?.name;
  if (org.standardsRepo && !seen.has(org.standardsRepo)) errs.push(`org.standardsRepo "${org.standardsRepo}" is not a repo`);

  if (errs.length) throw new Error(`Invalid governance config:\n  - ${errs.join('\n  - ')}`);
  return { version: 1, org, rules, commands, stack, features, intellisense, layerFolders, repos };
}

export function loadConfig(file) {
  return normalizeConfig(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function layersFor(config, repo) {
  const profile = readProfile(repo.profile);
  const codes = repo.layers ?? [...profile.layers, ...(config.org.regulated ? profile.regulatedLayers ?? [] : [])];
  return codes.map((c) => {
    const l = LAYER_BY_CODE[c];
    if (!l) throw new Error(`repo "${repo.name}": unknown layer "${c}"`);
    return { ...l, folder: config.layerFolders[c] ?? l.folder };
  });
}

// The variable bag every template for `repo` is rendered with.
export function contextFor(config, repo, now = new Date()) {
  const layers = layersFor(config, repo);
  const profile = readProfile(repo.profile);
  const iso = now.toISOString().slice(0, 10);
  const holdsStandards = config.org.standardsRepo === repo.name;
  const has = Object.fromEntries(LAYERS.map((l) => [layerKey(l.code), layers.some((x) => x.code === l.code)]));
  const siblings = config.repos.filter((r) => r.name !== repo.name).map((r) => {
    const p = readProfile(r.profile);
    return {
      name: r.name, profile: r.profile, role: p.role, description: r.description || p.role,
      path: `../${r.name}`, owns: r.owns, ownsList: r.owns.join('; '), hasOwns: r.owns.length > 0,
      followsThis: r.follows.includes(repo.name),
      followed: (repo.follows ?? []).includes(r.name),
      holdsStandards: config.org.standardsRepo === r.name,
    };
  });
  const checks = (profile.requiredChecks ?? []).filter((c) => !c.when || has[c.when] !== false).map((c) => c.name ?? c);
  if (config.features.intellisense) checks.push('Intellisense Gate');
  // The standards repo only has L0 docs when its profile ships the L0 layer; never point at docs that will not exist.
  const standards = config.repos.find((r) => r.name === config.org.standardsRepo);
  const hasStandards = Boolean(standards) && layersFor(config, standards).some((l) => l.code === 'L0');
  return {
    org: config.org, repo: { ...repo, ownsList: repo.owns.join('; '), hasOwns: repo.owns.length > 0, followsList: (repo.follows ?? []).join(', ') },
    profile: { name: repo.profile, role: profile.role },
    rules: config.rules, commands: config.commands, stack: config.stack, features: config.features,
    year: String(now.getFullYear()), date: iso,
    layers, has, hasLayers: layers.length > 0, holdsStandards, hasStandards, standardsRepo: config.org.standardsRepo,
    intellisense: { ...config.intellisense, agentsList: config.intellisense.agents.join(',') },
    standardsPath: holdsStandards ? 'docs/L0-foundation' : `../${config.org.standardsRepo}/docs/L0-foundation`,
    siblings, hasSiblings: siblings.length > 0, repos: config.repos,
    checks, checksJson: checks.map((c) => `{ "context": "${c}" }`).join(',\n            '),
    reviews: config.org.requiredReviews ?? 0,
    codeOwnerReview: Boolean(config.org.codeowners),
    bypassJson: config.org.bypass === 'repository-admin'
      ? '{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }'
      : '{ "actor_id": null, "actor_type": "OrganizationAdmin", "bypass_mode": "pull_request" }',
    template: { version: TEMPLATE_VERSION },
  };
}
