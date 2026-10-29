# L4-001 · Local Development Setup & Smoke Runbook

---
| Field | Value |
|---|---|
| Document ID | L4-001-local-dev-setup-v1 |
| Layer | L4 — Infrastructure & Deployment |
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

How to run @@repo.name@@ locally and prove it works. Update whenever prerequisites, bootstrap, smoke commands or troubleshooting change (L0-006 §3.4).

## 1 · Prerequisites
- Node @@stack.node@@, pnpm @@stack.pnpm@@ (pin via Volta or `engines`)
- ⚠️ GAP: Docker services, env files, secrets source

## 2 · Bootstrap
```bash
@@commands.install@@
bash bin/install-hooks.sh
```

## 3 · Smoke
```bash
@@commands.lint@@
@@commands.typeCheck@@
@@commands.test@@
bash bin/statutory-integrity.sh
```

## 4 · Known local limitations
⚠️ GAP: list what cannot be verified locally (e.g. CDN headers, push notifications, device-only behaviour) and where it *is* verified.

## Version history

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| v1 | @@date@@ | @@org.name@@ | Initial skeleton from repo-governance v@@template.version@@ |
