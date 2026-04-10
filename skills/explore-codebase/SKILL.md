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
| E   | entry points (exported symbols with high in-degree) |
| F   | execution flows / processes |

## Phase 1 — Orient

1. `tff-gitnexus_list_repos()` → confirm R is indexed
2. `tff-gitnexus_query({ query: "entry point", goal: "find main exports and entry points" })` → E
3. `tff-gitnexus_cypher({ query: "MATCH (n:Symbol) WHERE n.kind IN ['function','class'] RETURN n.cluster AS cluster, count(*) AS count ORDER BY count DESC LIMIT 10" })` → C overview

## Phase 2 — Deep dive

4. For top 3 clusters by size:
   `tff-gitnexus_query({ query: cluster_name, goal: "understand cluster purpose" })` → cluster detail
5. For top 3 entry points:
   `tff-gitnexus_context({ name: entry_point, include_content: true })` → callers, callees, code

## Phase 3 — Report

6. Present structured orientation:
   - **Repo**: R, total symbols, total clusters
   - **Architecture**: cluster map with purposes
   - **Entry points**: E with brief descriptions
   - **Key flows**: F — how data moves through the system
   - **Suggested next steps**: which areas to explore deeper

## Rules

- R1: Start broad (Phase 1), then narrow (Phase 2) — never skip orientation
- R2: Limit deep dives to top 3 to avoid overwhelming context
- R3: Always suggest next steps based on what was discovered
