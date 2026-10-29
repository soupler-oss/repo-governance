import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMPLATE_ROOT, TEMPLATE_VERSION, contextFor, layersFor, readProfile } from './config.mjs';
import { render, applyRegions } from './render.mjs';
import { generatedFiles } from './generated.mjs';
import { LAYERS } from './layers.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const MANIFEST_PATH = '.governance/manifest.json';

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p)];
  });
}

const matches = (rel, pattern) => (pattern.endsWith('/') ? rel.startsWith(pattern) : rel === pattern);

// Every file the repo should have: static templates (base, then profile overlay) + generated registries.
// Returns Map<relPath, {content, mode, kind}> where kind is 'managed' (template owns it) or 'seeded' (written once).
export function plan(config, repo, now = new Date()) {
  const ctx = contextFor(config, repo, now);
  const profile = readProfile(repo.profile);
  const base = readProfile('_base');
  const managed = [...(base.managed ?? []), ...(profile.managed ?? [])];
  const conditional = { ...(base.conditional ?? {}), ...(profile.conditional ?? {}) };
  const out = new Map();

  for (const root of ['_base', repo.profile]) {
    const dir = path.join(TEMPLATE_ROOT, 'profiles', root, 'files');
    for (const rel of walk(dir)) {
      const key = rel.replace(/\.tpl$/, '');
      // Folder and file names may carry template variables, e.g. @@org.slug@@-assets/…
      const dest = remapFolder(key.includes('@@') ? render(key, ctx, `${root}/${rel}`) : key, config);
      const cond = conditional[key];
      if (cond && !evalFlag(cond, ctx)) { out.delete(dest); continue; }
      if (profile.exclude?.includes(dest) && root === '_base') continue;
      const raw = fs.readFileSync(path.join(dir, rel));
      const content = raw.includes(0) ? raw.toString('latin1') : render(raw.toString('utf8'), ctx, `${root}/${rel}`);
      const mode = fs.statSync(path.join(dir, rel)).mode & 0o111 ? 0o755 : 0o644;
      out.set(dest, { content, mode, kind: managed.some((m) => matches(dest, m)) ? 'managed' : 'seeded' });
    }
  }
  for (const [dest, g] of generatedFiles(config, repo, ctx)) out.set(dest, g);
  return { files: out, ctx, layers: layersFor(config, repo) };
}

// Templates ship docs under the default layer folder names; an org may rename one (e.g. L3-engineering).
function remapFolder(rel, config) {
  for (const l of LAYERS) {
    const to = config.layerFolders[l.code];
    if (to && rel.startsWith(`docs/${l.folder}/`)) return `docs/${to}/${rel.slice(`docs/${l.folder}/`.length)}`;
  }
  return rel;
}

function evalFlag(expr, ctx) {
  return render(`@@#if ${expr}@@1@@/if@@`, ctx) === '1';
}

export function readManifest(dir) {
  const file = path.join(dir, MANIFEST_PATH);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

// mode: 'init' (new repo: write everything absent), 'adopt' (existing repo: managed files only unless docs=true),
//       'sync' (re-render against the recorded manifest, three-way for managed files).
export function apply(dir, config, repo, { mode = 'init', docs = true, dryRun = false, force = false, now = new Date() } = {}) {
  const { files } = plan(config, repo, now);
  const prev = readManifest(dir);
  const recorded = prev?.files ?? {};
  const report = { written: [], updated: [], regions: [], conflicts: [], skipped: [], unchanged: [] };
  const manifestFiles = {};

  for (const [rel, f] of [...files.entries()].sort()) {
    const abs = path.join(dir, rel);
    const exists = fs.existsSync(abs);
    const local = exists ? fs.readFileSync(abs, 'utf8') : null;
    const write = (text, bucket) => {
      report[bucket].push(rel);
      if (dryRun) return;
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text, { mode: f.mode });
      fs.chmodSync(abs, f.mode);
    };

    if (f.kind === 'seeded') {
      if (mode === 'adopt' && !docs) { report.skipped.push(rel); continue; }
      if (!exists) { write(f.content, 'written'); continue; }
      if (mode === 'sync' || mode === 'adopt') {
        const r = applyRegions(local, f.content);
        if (r.changed.length) { report.regions.push(`${rel} [${r.changed.join(', ')}]`); if (!dryRun) fs.writeFileSync(abs, r.text); }
        else report.skipped.push(rel);
      } else report.skipped.push(rel);
      continue;
    }

    // managed
    manifestFiles[rel] = sha(f.content);
    if (!exists) { write(f.content, 'written'); continue; }
    if (local === f.content) { report.unchanged.push(rel); continue; }
    const untouched = recorded[rel] && sha(local) === recorded[rel];
    if (untouched || force) { write(f.content, 'updated'); continue; }
    // Locally edited (or never recorded, as when adopting): never clobber — leave a sibling for review.
    report.conflicts.push(rel);
    manifestFiles[rel] = recorded[rel] ?? sha(local);
    if (!dryRun) fs.writeFileSync(`${abs}.governance-new`, f.content, { mode: f.mode });
  }

  if (!dryRun) {
    const manifest = {
      template: 'repo-governance', templateVersion: TEMPLATE_VERSION,
      syncedAt: now.toISOString(), repo: repo.name, profile: repo.profile,
      config, files: manifestFiles,
    };
    fs.mkdirSync(path.join(dir, '.governance'), { recursive: true });
    fs.writeFileSync(path.join(dir, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n');
  }
  return report;
}

// Standards that are seeded (so teams can edit them) still ship improvements. Report which are behind.
export function advisories(dir, config, repo) {
  const { files } = plan(config, repo);
  const out = [];
  for (const [rel, f] of files) {
    if (!/^docs\/L0-foundation\/L0-\d{3}-.*\.md$/.test(rel) || /-000-/.test(rel)) continue;
    const abs = path.join(dir, rel);
    if (!fs.existsSync(abs)) continue;
    const ver = (t) => Number((t.match(/^\|\s*Version\s*\|\s*v(\d+)/m) ?? [])[1] ?? 0);
    const mine = ver(fs.readFileSync(abs, 'utf8'));
    const theirs = ver(f.content);
    if (theirs > mine) out.push({ file: rel, local: `v${mine}`, template: `v${theirs}` });
  }
  return out;
}
