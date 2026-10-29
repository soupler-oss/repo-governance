# L0-010 · Repository Topology

---
| Field | Value |
|---|---|
| Document ID | L0-010-org-repo-topology-v1 |
| Layer | L0 — Foundation Standards |
| Status | Final |
| Version | v1 |
| Created | @@date@@ |
| Last Updated | @@date@@ |
| Owner | @@org.owner@@ |
| Reviewers | @@org.owner@@ |
| Copyright | © @@year@@ @@org.copyright@@. All rights reserved. |
| License | @@org.license@@ |
---

## Purpose

Which repositories make up @@org.name@@, what each owns, and which direction truth flows. This is the document behind every "never modify a sibling from here" rule in the repos' `CLAUDE.md` files.

<!-- gov:begin topology -->
@@#each repos as r@@
- **`@@r.name@@`** — profile `@@r.profile@@`@@#if r.description@@: @@r.description@@@@/if@@
@@/each@@
<!-- gov:end topology -->

Standards (L0) live in **`@@standardsRepo@@`**.

## Rules

1. One repository owns each fact; others follow. Following never edits the owner.
2. Locally the repos are siblings under one parent directory (`../<repo>`); tooling and docs refer to siblings by that relative path.
3. A change that spans repos is made in the owner first, then in each follower, as separate PRs in their own repositories.
4. Cross-origin calls between a client repo and an API repo require the API's allowed-origins list to be updated in the same change.

## Version history

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| v1 | @@date@@ | @@org.name@@ | Initial release from repo-governance v@@template.version@@ |
