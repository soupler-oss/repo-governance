# repo-governance — Project Instructions

This repository is **Soupler's governance generator**. One command stamps a complete, enforced documentation-governance ecosystem — repos, L0–L7 doc layers, CI gates, git hooks, rulesets, PR/issue templates, and `CLAUDE.md` agent instructions — into any new organisation or product. It captures an operating model that has run in production, including the corrections it accumulated, and must stay faithful to those lessons.

Always refer to the company as **Soupler** (or the target org's own name in generated output). **Never write an individual's name anywhere in this repository** — not in docs, templates, headers, version-history rows or examples. `tests/generate.test.mjs` fails the build if one appears.

## What this repo is NOT

It is not a product repo and not a place for any one organisation's or product's content — no company-specific names, products, repos or examples. Org-specific facts belong in that org's `governance.json` or its own repos. If a rule is genuinely general, generalise it here; if not, leave it out.

## Mental model (read before editing anything)

```
governance.json (org + repos + rules)
        │  normalizeConfig  →  contextFor(repo)            src/config.mjs
        ▼
profiles/_base/files  ─┐   render (@@ … @@)                src/render.mjs
profiles/<profile>/files ┴─►  plan() → Map<path,{content,kind}>   src/stamp.mjs
generated registries  ────┘                                 src/generated.mjs
        ▼
apply(): init | adopt | sync   →  files + .governance/manifest.json
        ▼
src/github.mjs: create repo · push · apply rulesets (explicit confirmation)
```

- **Profiles** (`profiles/<name>/profile.json` + `files/`): `product`, `site`, `assets`, `package`; `_base` is layered under every one. A profile file with the same path overrides base.
- **File kinds**: *managed* (listed in `profile.json` `managed`; template owns it; `gov sync` updates it only if the repo copy is untouched since last sync, otherwise writes `<file>.governance-new`) vs *seeded* (written once, then the org owns it). Seeded Markdown may contain `@@#region name@@ … @@/region@@` spans that `gov sync` keeps current (sibling lists, layer tables, topology).
- **Delimiters are `@@ … @@`**, not `{{ }}`, because generated files are full of `${{ github.* }}`. Unknown variables are a hard error.
- **Registries are generated** (`src/generated.mjs`) from the docs a profile ships, so a fresh repo passes its own gate.
- **Required status checks** come from `profile.json` `requiredChecks` and must equal CI job `name:`s. A test enforces it.

## The rules this generator exists to enforce in generated repos

The generated repos' `CLAUDE.md`, `.claude/skills/doc-governance/SKILL.md`, `.claude/settings.json` (SessionStart hook → `bin/governance-brief.sh`) and `.claude/commands/*` are how coding agents are made to follow doc governance on *every* task: classify the change → owning layer gets the first edit → doc-first (chain exists before code) → register every doc → CHANGELOG → run the gate → commit only when asked. When you change these, you change how every future project's agent behaves — treat them as the product.

## Working rules for this repo

1. **Doc-first applies here too.** A change to generated behaviour starts in `docs/` (or the L0 doc templates under `profiles/product/files/docs/L0-foundation/`), then templates, then code.
2. **Every behaviour change has a test that fails without it** (`pnpm test` runs `node --test tests/*.test.mjs`; zero dependencies). Generated output is tested by actually generating an org and running its gate, hooks and sync.
3. **Bump `package.json` version** when generated output changes (semver: breaking = existing repos' managed files change meaning; minor = new files/options; patch = fixes). Update `CHANGELOG.md`.
4. **Lessons are general or absent.** When a real incident teaches a governed repo a new rule, port the *general* lesson (with its reason, never the company-specific story) into the L0 docs or `CLAUDE.md` templates.
5. **Adoption must stay safe.** `gov adopt`/`sync` never overwrite a file a team edited. The SIVE gate runs in *adoption mode* (warnings for header/registry drift) unless `.governance/sive.json` says `strict: true`.
6. **Never commit generated org directories** or anything with a real secret.

## Git workflow and protection (this repo is public and protected)

- Branch from `develop`, PR into `develop`. **`main` only ever receives `develop`** (`Branch Policy` check). Never commit or push directly to `main` or `develop` - the rulesets refuse it for everyone except the maintainer's PR-only bypass.
- Rulesets live in `.github/governance/rulesets/` (apply with `gov github <repo-dir> --rulesets-only`): PR required, 1 approval from the code owner (`.github/CODEOWNERS`), approval of the last push, required checks `Statutory Integrity` + `PR Metadata` + `Tests` + `Secret Scan` (+ `Branch Policy` on `main`), no force-push, no deletion; `develop` squash/rebase and linear, `main` merge commits; `v*` tags can only be created by an organisation admin (`release-tags`). Bypass is the Organization admin role, via pull request only.
- This repo is governed by its own generator (`package` profile, `.governance/manifest.json`): the gate, hooks, `PR Metadata` and `Secret Scan` workflows and `.claude/` are managed files - change them in `profiles/_base/files/` and run `node bin/gov.mjs sync .`, not by hand. Run `bash bin/install-hooks.sh` once per clone.
- PR titles are Conventional Commits; the `develop` -> `main` promotion starts with `release:`.
- Licensed Apache-2.0 (see `LICENSE`, `NOTICE`); contributions come via forks per `CONTRIBUTING.md`.
- **Commit and push only when asked.** No AI attribution in commits or PR descriptions.
