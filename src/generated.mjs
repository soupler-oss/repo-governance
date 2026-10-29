import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATE_ROOT } from './config.mjs';
import { render } from './render.mjs';
import { LAYER_BY_CODE } from './layers.mjs';

const field = (text, key) => (text.match(new RegExp(`^\\|\\s*${key}\\s*\\|\\s*(.+?)\\s*\\|\\s*$`, 'm')) ?? [])[1] ?? '';
const title = (text) => (text.match(/^#\s+[A-Z0-9.]+-\d{3}\s*[·\-–—]*\s*(.+)$/m) ?? [])[1]?.trim() ?? "";

function shippedDocs(repo, layerFolder, ctx) {
  const rows = new Map();
  for (const root of ['_base', repo.profile]) {
    const dir = path.join(TEMPLATE_ROOT, 'profiles', root, 'files', 'docs', layerFolder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md') || f.includes('-000-')) continue;
      const text = render(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, `${root}/${f}`);
      const id = f.replace(/\.md$/, '').replace(/\.tpl$/, '');
      rows.set(id, { id, title: field(text, 'Title') || title(text), status: field(text, 'Status') || 'Draft', version: field(text, 'Version') || 'v1', owner: ctx.org.owner, updated: field(text, 'Last Updated') || ctx.date });
    }
  }
  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function header(ctx, id, layer, extra = {}) {
  const rows = {
    'Document ID': id, Layer: `${layer.code} — ${layer.name}`, Status: 'Final', Version: 'v1', Created: ctx.date,
    'Last Updated': ctx.date, Owner: ctx.org.owner, Reviewers: ctx.org.owner,
    Copyright: `© ${ctx.year} ${ctx.org.copyright}. All rights reserved.`, License: ctx.org.license, ...extra,
  };
  return ['---', '| Field | Value |', '|---|---|', ...Object.entries(rows).map(([k, v]) => `| ${k} | ${v} |`), '---'].join('\n');
}

export function registryContent(ctx, layer, repo) {
  const id = `${layer.code}-000-artifact-registry-v1`;
  const docs = shippedDocs(repo, LAYER_BY_CODE[layer.code].folder, ctx);
  const table = docs.length
    ? docs.map((d) => `| ${d.id} | ${d.title} | ${d.status} | ${d.version} | ${d.owner} | ${d.updated} |`).join('\n')
    : '';
  const extra = layer.code === 'L7' ? '\nThe chain-of-custody table lives in `L7-001-master-registry-v1`; every remediation session adds one row there.\n' : '';
  return `# ${layer.code}-000 · ${layer.name} Artifact Registry

${header(ctx, id, layer)}

## Purpose

Registry of every artifact in layer **${layer.code} — ${layer.name}** (${layer.desc}). This layer owns: *${layer.owns}*. It does not own: ${layer.notOwn}.

**Every \`.md\` artifact under this folder — including numbered subfolders — must have a row below, in the same commit that creates it.** The Statutory Integrity gate (\`bin/statutory-integrity.sh\`) blocks the PR otherwise. When an artifact's own \`Version\` or \`Last Updated\` header changes, update its row here in the same commit.
${extra}
## Registered Artifacts

| Document ID | Title | Status | Version | Owner | Last Updated |
|---|---|---|---|---|---|
${table ? table + '\n' : ''}
## Version history

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| v1 | ${ctx.date} | ${ctx.org.name} | Registry created by repo-governance v${ctx.template.version} |
`;
}

export function generatedFiles(config, repo, ctx) {
  const out = new Map();
  for (const layer of ctx.layers) {
    const dest = `docs/${layer.folder}/${layer.code}-000-artifact-registry-v1.md`;
    out.set(dest, { content: registryContent(ctx, layer, repo), mode: 0o644, kind: 'seeded' });
  }
  return out;
}
