---
name: pre-commit-review
description: >
  Review changes before committing — detect which symbols and processes are affected by the
  current diff. Use when: "pre-commit" | "review changes" | "what breaks" |
  "what am i changing" | "impact of diff"
allowed-tools: tff-gitnexus_detect_changes tff-gitnexus_impact tff-gitnexus_context
---

# Pre-Commit Review

## Symbols

| Sym | Meaning |
|-----|---------|
| Δ   | set of changed symbols (from detect_changes) |
| P   | affected execution processes |
| D1  | direct dependents of each Δ member |

## Phase 1 — Detect

1. `tff-gitnexus_detect_changes({ scope: "staged" })` → Δ, P
2. If nothing staged: `tff-gitnexus_detect_changes({ scope: "all" })` → Δ, P

## Phase 2 — Analyze

3. For each member of Δ (up to 5 highest-risk):
   `tff-gitnexus_impact({ target: member, direction: "upstream" })` → D1
4. For any Δ member with D1 count > 3:
   `tff-gitnexus_context({ name: member })` → full context

## Phase 3 — Report

5. Present structured review:
   - **Changed symbols**: Δ with file locations
   - **Affected processes**: P — which execution flows are touched
   - **Unupdated dependents**: D1 members not in Δ — potential breakage
   - **Verdict**: SAFE (all D1 updated) | REVIEW (some D1 untouched) | RISKY (process-crossing changes)

## Rules

- R1: Always check staged first, fall back to all
- R2: Flag any D1 dependent not in the changeset as potential breakage
- R3: Never approve changes that cross process boundaries without explicit user acknowledgment
