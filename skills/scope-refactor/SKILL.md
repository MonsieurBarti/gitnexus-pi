---
name: scope-refactor
description: >
  Scope a refactor with impact analysis before touching code. Identifies blast radius, dependent
  processes, and downstream risks. Use when: "refactor" | "rename" | "scope refactor" |
  "safe refactor" | "impact" | "blast radius"
allowed-tools: tff-gitnexus_impact tff-gitnexus_context tff-gitnexus_query
---

# Scope Refactor

## Symbols

| Sym | Meaning |
|-----|---------|
| T   | target symbol (the thing being refactored) |
| D1  | depth-1 dependents (WILL BREAK — direct callers/importers) |
| D2  | depth-2 dependents (LIKELY AFFECTED — indirect) |
| P   | execution processes containing T |

## Phase 1 — Resolve target

1. `tff-gitnexus_query({ query: T })` → confirm T exists, get file + cluster
2. `tff-gitnexus_context({ name: T })` → full 360° view: callers, callees, cluster, processes

## Phase 2 — Blast radius

3. `tff-gitnexus_impact({ target: T, direction: "upstream" })` → D1, D2 callers
4. `tff-gitnexus_impact({ target: T, direction: "downstream" })` → callees that may need updating

## Phase 3 — Report

5. Present structured report:
   - **Target**: T, file, cluster
   - **D1 (WILL BREAK)**: list each with file — these MUST be updated
   - **D2 (LIKELY AFFECTED)**: list — should test
   - **Processes**: P — execution flows to verify end-to-end
   - **Risk**: HIGH if D1 > 5 or crosses cluster boundaries

## Rules

- R1: Never proceed to code changes without completing Phase 2
- R2: If risk is HIGH, warn user before any modifications
- R3: After refactor, run `tff-gitnexus_detect_changes()` to verify scope matches report
