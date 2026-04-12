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

## O_scope

O_resolve {
  1. `tff-gitnexus_query({ query: T })` → confirm T exists, get file + cluster;
  2. `tff-gitnexus_context({ name: T })` → 360° view: callers, callees, cluster, processes;
} → {T, file, cluster, P}.

O_blast {
  3. `tff-gitnexus_impact({ target: T, direction: "upstream" })` → {D1, D2} callers;
  4. `tff-gitnexus_impact({ target: T, direction: "downstream" })` → callees;
} → {D1, D2, callees}.

O_report {
  5. Output: T, file, cluster; D1 → MUST update; D2 → test; P → verify; risk ∈ {HIGH, LOW};
} → report.

## Rules

R1: ¬complete(O_blast) → ¬proceed.
R2: risk = HIGH → warn ∧ ¬modify.
R3: post_refactor → `tff-gitnexus_detect_changes()` → verify_scope.
