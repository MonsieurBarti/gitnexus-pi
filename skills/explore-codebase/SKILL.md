---
name: explore-codebase
description: >
  Understand an unfamiliar codebase using the knowledge graph. Discovers structure, clusters,
  key symbols, and execution flows. Use when: "explore" | "understand" | "new codebase" |
  "orient" | "what does this do"
allowed-tools: tff-gitnexus_cypher tff-gitnexus_query tff-gitnexus_context tff-gitnexus_list_repos
---

# Explore Codebase

## Symbols

| Sym | Meaning |
|-----|---------|
| R   | target repo |
| C   | clusters (functional areas) |
| E   | entry points (exported symbols w/ high in-degree) |
| F   | execution flows / processes |

## O_explore

O_orient {
  `tff-gitnexus_list_repos()` → R indexed;
  `tff-gitnexus_query({ query: "entry point", goal: "find main exports and entry points" })` → E;
  `tff-gitnexus_cypher({ query: "MATCH (n:Symbol) WHERE n.kind IN ['function','class'] RETURN n.cluster AS cluster, count(*) AS count ORDER BY count DESC LIMIT 10" })` → C;
} → {R, E, C}.

O_dive {
  ∀ c ∈ top3(C): `tff-gitnexus_query({ query: cluster_name, goal: "understand cluster purpose" })`;
  ∀ e ∈ top3(E): `tff-gitnexus_context({ name: entry_point, include_content: true })`;
} → {C_detail, E_detail}.

O_report { output: R, |syms|, |C|; C_map; E_desc; F_dataflow; next; } → orientation.

## Rules

R1: orient → dive ∧ ¬skip.
R2: |dives| ≤ 3 → ¬overflow.
R3: ∃ d ∈ discoveries → suggest(d).
