#!/bin/bash
# Printed into every Claude Code session by .claude/settings.json (SessionStart hook).
# A rule in CLAUDE.md can be forgotten mid-session; this puts the gate in front of the agent at the start.
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
echo "GOVERNANCE BRIEF — @@repo.name@@ (@@org.name@@)"
echo "  Branch: $BRANCH"
case "$BRANCH" in
  main|develop) echo "  !! You are on a protected branch. Never commit here. Cut <type>/<slug> from develop (ask the user before creating a branch)." ;;
esac
@@#if hasLayers@@
echo "  1. Classify the change first: strategic (L1) · product (L2) · engineering (L3) · operational (L0/L4/L5)."
echo "  2. Golden Rule: the layer that owns the problem gets the first edit; downstream docs sync to it, never the reverse."
echo "  3. Doc-first: if the doc chain for this work is missing, write it (and register it) BEFORE code."
echo "  4. Every new .md is registered in its layer's -000-artifact-registry in the same commit."
@@else@@
echo "  1-4. This repo has no documentation layers (docs/L*): the design for a change lives in the repo that owns it@@#if hasStandards@@ (standards: @@standardsRepo@@)@@/if@@; record what changed here in CHANGELOG.md and README.md."
@@/if@@
echo "  5. Always update CHANGELOG.md. Run bash bin/statutory-integrity.sh before declaring done."
@@#if rules.noAiAttribution@@
echo "  6. Commits and PR descriptions carry NO AI attribution (no Co-Authored-By, no 'Generated with', no session links)."
@@/if@@
@@#if features.intellisense@@
echo "  7. Risk tier: run \`intellisense classify\` before you start. Tier 1+ commits carry a task trailer and the change a contract (the push hook and CI check it)."
@@/if@@
echo "  Full rules: CLAUDE.md · skill: doc-governance@@#if hasStandards@@ · standards: @@standardsPath@@@@/if@@"
