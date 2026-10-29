# L3-001 · System Architecture

---
| Field | Value |
|---|---|
| Document ID | L3-001-system-architecture-v1 |
| Layer | L3 — Architecture |
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

The map of @@repo.name@@: components, boundaries, data ownership and the ADRs that justify them. Update this whenever a boundary or diagram stops being true (L0-006 §3.3).

## 1 · Components and boundaries

⚠️ GAP: list each app/service/package, what it owns, what it may call, and what it must not touch.

| Component | Owns | Calls | Must not touch |
|---|---|---|---|
| TODO | | | |

## 2 · Data ownership

⚠️ GAP: which component owns which tables/topics; cross-component access goes through contracts only.

## 3 · Architecture Decision Records

An ADR is required when a change alters *how the system works*, not merely that it works. Add each as a numbered section below (never renumber), or as its own `L3-NNN-adr-slug-v1` document once it outgrows a section.

### ADR-001 — TODO title
- **Status**: Proposed | Accepted | Superseded by ADR-NNN
- **Context**: what forced the decision
- **Decision**: what we chose
- **Consequences**: what gets easier, what gets harder, what we now must enforce (and how)

## Version history

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| v1 | @@date@@ | @@org.name@@ | Initial skeleton from repo-governance v@@template.version@@ |
