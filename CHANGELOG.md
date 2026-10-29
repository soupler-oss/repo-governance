# Changelog

## [Unreleased]

## [1.2.2] - 2026-10-29

### Changed
- Renamed the project from `soupler-governance-template` to `repo-governance` (package `@soupler-oss/repo-governance`); it now lives at `github.com/soupler-oss/repo-governance`. Repository, clone and security-advisory URLs in `README.md`, `SECURITY.md`, `NOTICE`, `package.json` and the issue-template config now point there.
- Generated output names the generator `repo-governance`: version-history rows in seeded docs and registries, the seeded `CHANGELOG.md`, `CLAUDE.md`, and the managed `bin/statutory-integrity.mjs` and `.github/PROTECTION_GUIDE.md`. `.governance/manifest.json` records `template: "repo-governance"`. `gov sync` updates the two managed files in existing repos; seeded files keep the old name.
- `README.md` rewritten as a project page: what it is and why, quick start, real gate, hook and `sync` output, profiles, status and FAQ. The reference material moved into `docs/`: the wizard walkthrough into `docs/wizard.md`; what gets generated, the layers, change flow, enforcement and agent mechanisms into `docs/concepts.md`; publishing, `sync` file kinds and the full `governance.json` reference (with defaults) into `docs/usage.md`.

### Repository
This repository's own protection; generated output is unchanged.
- This repository is now governed by its own generator (`package` profile, `.governance/manifest.json`, strict gate): `Statutory Integrity`, `PR Metadata` and `Secret Scan` workflows, the post-merge issue-closure workflow, `commit-msg` and `pre-commit` hooks (`bash bin/install-hooks.sh`), `.github/PROTECTION_GUIDE.md`, and `.claude/` skill and commands. `.gitleaks.toml` allowlists only the manifest.
- `release-tags` ruleset: only an organisation admin can create, move or delete `v*` tags.
- `.github/dependabot.yml` (monthly, grouped GitHub Actions updates into `develop`), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.0), and a `## Docs update` block and `## Issues` section in the PR template.
- Rulesets: the bypass is the Organization admin role (via pull request only), the last push must be approved, and the required checks are `Statutory Integrity`, `PR Metadata`, `Tests` and `Secret Scan` (+ `Branch Policy` on `main`). `PR Metadata` checks the PR title, so the separate `PR Title` workflow is removed.
- This repo's own workflows use `actions/checkout` v7 and `actions/setup-node` v7, like generated repos.

## [1.2.1] - 2026-10-15

### Fixed
- `PR Metadata` (`pr-governance.yml`, managed) no longer fails every Dependabot PR: the `## Docs update` block is not required when the PR author is `dependabot[bot]`, since Dependabot writes its own body (release notes) and a version bump changes no owning doc. The title rule and the no-AI-attribution rule still apply to every PR. L0-005 v2 §2 states the exception; `docs/usage.md` notes it under `rules.requireDocsUpdate`.

### Changed
- Generated workflows use current major versions of the GitHub actions: `actions/checkout` v7 and `actions/setup-node` v7 (`pr-governance.yml`, `secret-scan.yml`, `ci.yml`), `actions/github-script` v9 (`post-merge-issue-closure.yml`; its script uses only the injected `github` and `context`, so the v9 removal of `require('@actions/github')` does not affect it).

## [1.2.0] - 2026-10-05

### Changed
- The `assets` profile now makes the repo the **source of truth for the brand** by default (logos, palette, fonts, media). Other repos are told to take their brand from it. Previously it assumed the product repo owned the brand and `assets` followed it.
- `follows` wording in generated `CLAUDE.md` files now says what is followed (`follows that one for <what it owns>`), and sibling lines use a consistent separator.

### Added
- The `assets` profile scaffolds a numbered category tree named after the org (`<slug>-assets/01-brand/logos/{svg,png}`, `02-social-media/{instagram,linkedin,youtube}`, `03-app-store/listing/{source,iphone,ipad}`, `04-documents`), `rendering/src` scripts that derive mono-black, mono-white and favicon variants from the primary logos and render PNGs (`pnpm render:logos`), a `package.json`, and a README with the structure tree.
- `gov sync --config <file>` adopts an updated org config (for example changed ownership) and refreshes every generated section.
- Folder and file names in profiles can contain template variables.
- Profiles can declare `defaultOwns`.

## [1.1.0] - 2026-10-04

### Added
- Apache-2.0 `LICENSE` and `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`, issue and PR templates, `CODEOWNERS`.
- Repository protection for this repo: rulesets (PR-only, owner approval, required `Tests`/`PR Title`/`Branch Policy`, no force-push or deletion), `Branch Policy` and `PR Title` workflows.
- Generator option `org.bypass` (`organization-admin` | `repository-admin`) so personal GitHub accounts get a valid bypass actor; rulesets now require code-owner review whenever `org.codeowners` is set.

## [1.0.0] - 2026-10-04

### Added
- `gov` CLI: `new-org`, `add-repo`, `adopt`, `sync`, `github`, `audit`, `profiles`, `doctor`.
- Profiles `product`, `site`, `assets`, `package` layered over a shared `_base`.
- Statutory Integrity gate v2 (`bin/statutory-integrity.mjs`): recursive registration, stale-row and Version/Last-Updated freshness checks, header checks; strict vs adoption mode via `.governance/sive.json`.
- Ten portable L0 standards including engineering principles (modularity, no duplication, single source of truth, centralised tokens, no localhost fallbacks) and generated repo topology.
- Workflows: Branch Policy, PR Governance (SIVE + PR Metadata with `## Docs update` and `release:` titles), Secret Scan, CI seed, post-merge issue closure.
- Rulesets (`main-develop-protection`, `main-protection`, `main-develop-undeletable`) with an idempotent applier; GitHub publishing always requires confirmation.
- Agent layer: governance-first `CLAUDE.md` per profile, `doc-governance` skill, slash commands, SessionStart governance brief.
- Manifest-based `sync` that never overwrites a locally edited file; managed `gov:begin/end` regions in seeded docs.
- Example org configuration.
