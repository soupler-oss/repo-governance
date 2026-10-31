# @@org.name@@ `@@repo.name@@` — Project Instructions

This is `@@repo.name@@` (`@@org.github@@/@@repo.name@@`) — a **shared package**: the single source of truth for content or logic that several @@org.name@@ repositories consume.

**Governance applies to all work here.** Read `.claude/skills/doc-governance/SKILL.md` first. @@#if hasStandards@@Standards (L0) live in `@@standardsRepo@@` (`@@standardsPath@@`).@@/if@@

@@#region siblings@@
## Consumers and siblings

@@#if hasSiblings@@
@@#each siblings as s@@
- **`@@s.name@@`** (`@@s.path@@`) — @@s.description@@
@@/each@@

**Never modify a sibling's files from inside this repo.**
@@else@@
No sibling repositories are registered.
@@/if@@
@@/region@@

## How changes ship

1. Change the content/logic **here** — this repo is the only place it is edited. Consumers must never hand-edit a copy.
2. Tag a release (`vX.Y.Z`, SemVer) after the `develop` → `main` promotion, with a `CHANGELOG.md` entry.
3. **Every consumer bumps its pin in its own PR**, and the change is not complete until all of them have. A partially-propagated release means different products serve different content — record outstanding consumers explicitly (SYNCED / OUTSTANDING) in the owning sync log rather than leaving it unsaid.
4. The consumer's **lockfile SHA is what guarantees identical bytes** — a git tag can be force-moved. Never move a published tag; cut a new one.

## Git workflow

Branch from `develop`, PR to `develop`, only `develop` → `main`; Conventional Commits; commit/push only when asked.
@@#if rules.noAiAttribution@@
No AI attribution in commits or PR descriptions — the `commit-msg` hook blocks it.
@@/if@@
Install hooks once per clone: `bash bin/install-hooks.sh`. Always update `CHANGELOG.md`; run `bash bin/statutory-integrity.sh` before declaring done.
