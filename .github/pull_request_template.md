<!--
Title: a Conventional Commit, e.g. `feat(profiles): add a mobile profile`.
Target: `develop`. Only the `develop` → `main` promotion (titled `release: …`) targets `main`.
How to fill this in: CONTRIBUTING.md → "Before you open a PR".
-->

## Summary
- <!-- what changes and why -->

## Issues
- Closes #<!-- the issue this finishes; it closes on merge -->
- Relates to #<!-- optional -->

## Test plan
- `pnpm test` <!-- plus anything else you ran -->

## Docs update
- Status: `UPDATED`
- Notes: <!-- list the docs you touched (README, docs/*.md, CHANGELOG.md, L0 templates), or explain why this change is exempt -->

> Keep the exact `- Status:` / `- Notes:` bullet format. CI parses these lines literally.
> `UPDATED` = the docs this change affects and `CHANGELOG.md` changed in this PR.
> `EXEMPT` needs a reason in Notes (e.g. "typo fix inside a code comment").

## Checklist
- [ ] Opened against `develop` (only the maintainer's `develop` → `main` promotion targets `main`)
- [ ] Title is a Conventional Commit, e.g. `feat(profiles): add a mobile profile`
- [ ] `pnpm test` and `bash bin/statutory-integrity.sh` pass
- [ ] No company-, product- or person-specific names or examples (the generator is generic)
- [ ] `CHANGELOG.md` updated; `package.json` version bumped if generated output changes
- [ ] I am licensing this contribution under Apache-2.0 (see CONTRIBUTING.md)
