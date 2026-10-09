# Evidence and delivery read-only audit

Executed 2026-10-09T06:31:37.568Z; America/New_York; commit 62141347a0a8e48d779ad9c3dad15463e38e22ac.

Program: tools/audit_evidence_delivery.mjs. Independent arithmetic does not import metrics.mjs. Product builders and summaries are the system under test. Financial original-PDF audit is separate. No production edits or deployment.

Results: {"PASS":120,"FAIL":3,"UNVERIFIED":4}. Evidence inventory: 81, {"PASS":81,"FAIL":0}.

## Findings

- **AUD-E01 / FAIL / medium** — Cross-source duplicate OCF in supplementary full report and primary snapshot is not included in conflict comparison. Fault injection produced two contradictory FACT values. (lib/research/evidence.mjs:21; 74-78) Proposed only: normalize supplementary comparable fields into the conflict registry and reject differing same-period/same-basis values; add regression.
- **AUD-E02 / FAIL / medium** — The fourteen-evidence cap can omit explicitly selected evidence while the request context still lists those IDs. (lib/research/llm.mjs:98-99) Proposed only: reserve selected evidence first, then fill remaining budget with topic evidence; verify all selected IDs have corresponding model evidence.
- **AUD-E03 / FAIL / low** — Supplementary SZSE evidence retains a hardcoded 巨潮资讯 source_name; raw links correctly point to SZSE. (lib/research/evidence.mjs:33) Proposed only: label public reports generically or derive publisher from source metadata.
- **AUD-S01 / FAIL / medium** — One actual accepted model output describes cash-conversion speed from aggregate amount-growth evidence. This is unsupported by the cited fields. (docs/auto-audit/public-llm.json; case 经营质量, claim 2) Proposed only: describe slower OCF amount growth; prohibit timing/collection-speed conclusions without turnover or dated collection evidence. Add this actual output as a semantic regression.

## Independent AI review of real public samples

5 actual cases reviewed; narrow claim results {"PASS":11,"FAIL":1,"UNVERIFIED":1}. This is separate AI judgment with source constraints, not deterministic proof or candidate review. All claim-specific reasons are recorded in JSON.

## Unverified

- SEMANTIC_ALL_PROSE: Deterministic IDs, formulas and finite guards do not certify all financial prose or business causal truth.
- SOURCE_UNIVERSE_COMPLETENESS: Four source reports and a selected field set do not establish that all relevant filings, notes, events or risks are covered.
- DATA_DISPLAY_RIGHTS: Account holder must confirm data display and redistribution permissions; no granted Fuyao/iFinD credentials are present.
- FORMAL_SECURITY_AUDIT: Pattern and exact-current-secret scans cannot prove absence of every secret, compromised historical secret or external credential abuse.

Fault injections are offline regression probes, not real Groq observations or changes to actual data. Full results, IDs, independent/product values, raw mapping checks and network statuses: evidence-delivery.json. No matching secret content is included.

## Additional context diagnostic provenance

The separately saved calculation-basis context diagnostic returned HTTP 200 but engine=rules and status=FAIL: its analysis request failed with provider HTTP 400. Only one successful planner response is recorded. The four fallback statements duplicate the already reviewed rules statements and are excluded from the 13 unique semantic samples. This is not an LLM interpretation success. Source: public-context-diagnostic.json.

Primary source label refinement: nine SZSE-backed objects are mislabeled; the mixed-source profit reconciliation correctly retains cninfo as its first-source label. No additional network probes or production edits were performed for this report correction.
