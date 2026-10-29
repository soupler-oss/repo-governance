# L0-008 · Copyright Headers Standard

---
| Field | Value |
|---|---|
| Document ID | L0-008-copyright-headers-standard-v1 |
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

Every governed document and source file declares ownership and licence consistently.

## 1 · Documents

The `Copyright` header field is always `© <current year> @@org.copyright@@. All rights reserved.` and `License` defaults to `@@org.license@@`. The year is the year of creation and is not rewritten on edits.

## 2 · Source files

New source files in first-party packages carry a one-line header comment:

```
// © @@year@@ @@org.copyright@@. All rights reserved.
```

Generated files, vendored code and third-party snippets keep their original notices and are never relabelled.

## 3 · Third-party material

Anything under a licence (fonts, icons, music, stock media) is recorded with its licence and permitted use before it ships.

## Version history

| Version | Date | Author | Summary of changes |
|---|---|---|---|
| v1 | @@date@@ | @@org.name@@ | Initial release from repo-governance v@@template.version@@ |
