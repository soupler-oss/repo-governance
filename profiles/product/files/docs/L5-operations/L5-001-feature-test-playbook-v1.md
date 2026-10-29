# L5-001 · Feature Test Playbook

---
| Field | Value |
|---|---|
| Document ID | L5-001-feature-test-playbook-v1 |
| Layer | L5 — Operations & GTM |
| Status | Draft |
| Version | v1 |
| Created | @@date@@ |
| Last Updated | @@date@@ |
| Owner | @@org.owner@@ |
| Reviewers | @@org.owner@@ |
| Copyright | © @@year@@ @@org.copyright@@. All rights reserved. |
| License | @@org.license@@ |
---

## Purpose

How every shipped feature — and the current integrated slice — is verified, by a human or CI. Update it whenever shipped functionality, setup or verification steps change.

## 1 · Section template (one per feature)

### Feature: TODO
- **Prerequisites**: services running, seed data, accounts
- **Steps**: numbered, executable
- **Expected results**: observable outcome per step (UI state, response body, DB row, log line)
- **Error paths**: empty results, wrong status, missing data, boundary values
- **Automated checks**: the test files/commands that cover it
- **Known local limitations**: what this playbook cannot prove, and where that is verified instead

## 2 · Features
⚠️ GAP: add a section per shipped feature.

## Version history

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| v1 | @@date@@ | @@org.name@@ | Initial skeleton from repo-governance v@@template.version@@ |
