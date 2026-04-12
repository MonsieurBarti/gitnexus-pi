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

## O_review

O_detect {
  1. `tff-gitnexus_detect_changes({ scope: "staged" })` → Δ, P;
  2. staged = ∅ → `tff-gitnexus_detect_changes({ scope: "all" })` → Δ, P;
} → {Δ, P}.

O_analyze {
  3. ∀ m ∈ top5_risk(Δ): `tff-gitnexus_impact({ target: m, direction: "upstream" })` → D1;
  4. ∃ m ∈ Δ: |D1| > 3 → `tff-gitnexus_context({ name: m })` → full context;
} → {D1, context}.

O_report {
  5. Output: Δ w/ locations; P — touched flows; D1 \ Δ — potential breakage; verdict ∈ {SAFE, REVIEW, RISKY};
} → review.

## Rules

R1: staged → detect(staged); ¬staged → detect(all).
R2: d ∈ D1 ∧ d ∉ Δ → flag_breakage(d).
R3: process_crossing(Δ) ∧ ¬user_ack → ¬approve.
