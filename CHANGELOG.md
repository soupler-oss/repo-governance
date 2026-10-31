# Changelog

## [Unreleased]

## [1.3.1] - 2026-10-31

### Fixed
- `features.intellisense` pinned the GitHub Action to `soupler-oss/intellisense@v3.0.0`, a release that does not
  exist, so the generated `Intellisense Gate` check could not run. The default is now `1.0.1`, the current release.
- README: explains the intellisense integration (what it adds, how to turn it on) in "What you get" and the FAQ.

## [1.3.0] - 2026-10-31

### Added
- `gov` CLI: `new-org`, `add-repo`, `adopt`, `sync`, `github`, `audit`, `profiles`, `doctor`. `gov sync --config
  <file>` adopts an updated org config (for example changed ownership) and refreshes every generated section.
- Profiles `product`, `site`, `assets`, `package` layered over a shared `_base`. Folder and file names in profiles can
  contain template variables; profiles can declare `defaultOwns`.
- The `assets` profile makes the repo the source of truth for the brand (logos, palette, fonts, media): a numbered
  category tree named after the org (`<slug>-assets/01-brand/logos/{svg,png}`, `02-social-media/…`,
  `03-app-store/…`, `04-documents`), `rendering/src` scripts that derive mono-black, mono-white and favicon variants
  and render PNGs (`pnpm render:logos`), and a README with the structure tree.
- Statutory Integrity gate (`bin/statutory-integrity.mjs`): recursive registration, stale-row and
  Version/Last-Updated freshness checks, header checks; strict vs adoption mode via `.governance/sive.json`. A repo
  without doc layers is told to record changes in CHANGELOG/README.
- Ten portable L0 standards, including engineering principles (modularity, no duplication, single source of truth,
  centralised tokens, no localhost fallbacks) and generated repo topology.
- Workflows: Branch Policy, PR Governance (SIVE + PR Metadata with `## Docs update` and `release:` titles; Dependabot
  PRs need no `## Docs update` block), Secret Scan, CI seed, post-merge issue closure. Generated workflows use
  `actions/checkout` v7, `actions/setup-node` v7 and `actions/github-script` v9.
- Rulesets (`main-develop-protection`, `main-protection`, `main-develop-undeletable`, `release-tags`) with an
  idempotent applier; GitHub publishing always requires confirmation. `org.bypass` (`organization-admin` |
  `repository-admin`) sets the bypass actor; rulesets require code-owner review whenever `org.codeowners` is set.
- Agent layer: governance-first `CLAUDE.md` per profile (`follows that one for <what it owns>` lines for sibling
  repos), `doc-governance` skill, slash commands, SessionStart governance brief.
- Manifest-based `sync` that never overwrites a locally edited file; managed `gov:begin/end` regions in seeded docs.
- **intellisense integration** (`features.intellisense`, off by default): generated repos get a managed
  `.githooks/pre-push` that runs `intellisense gate --pre-push`, a managed `.github/workflows/intellisense.yml`
  (the `Intellisense Gate` check, also a required check in the branch rulesets), and a risk-tier line in the session
  brief, the doc-governance skill and the README. `gov` runs `intellisense init --yes --no-hook` for each generated
  or adopted repo when the binary is installed, and prints the command otherwise. Configure it with
  `intellisense: { version, tracker, agents }`; the wizard asks.
- Project files: Apache-2.0 `LICENSE` and `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
  (Contributor Covenant 2.0), issue and PR templates, `CODEOWNERS`, `.github/dependabot.yml`. This repository is
  governed by its own generator (`package` profile, strict gate).
- Example org configuration; docs in `docs/` (`wizard.md`, `concepts.md`, `usage.md` with the full
  `governance.json` reference).
- **Starter docs follow a repo's layers**, not its profile: a repo that opts into layers with `repos[].layers` (for
  example a `package` repo choosing L0, L2–L4 and L6–L7) gets those layers' starter docs and registry rows from the
  product profile, unless its own profile ships them. L0 standards go only to the standards repo.
- **`org.githubDefaultBranch`** (default `main`): the branch GitHub shows first, so visitors see the released version.
  `gov github` sets it; work still targets `org.defaultBranch` (`develop`). The generated protection guide says both.
- `org.defaultBranch` must be `develop`, because the generated rulesets, workflows and docs protect and target it; the
  wizard no longer asks for it.
