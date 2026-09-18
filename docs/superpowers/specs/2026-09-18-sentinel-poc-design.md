# SENTINEL Release Check — POC Design

**SENTINEL** — *System for Engineering Notifications, Triage, Intelligence,
Evidence and Lifecycle*.

## Context

SENTINEL is an internal TypeScript CLI that audits, before a release ships,
whether the operational changes present in the not-yet-released commits of
each application are described in that release's documents. There is no
existing flow, catalog, or prior code in the workspace for this — it is a
new, independent project at `projects/sentinel`.

The workspace already contains `projects/yandecode`, with `@yandecode/core`
and `@yandecode/retrieval` built (`dist/` present), implementing exactly the
local-first RAG architecture requested (SQLite FTS5/BM25 + USearch HNSW +
`@huggingface/transformers` + RRF + MMR + Tree-sitter/Markdown chunking). Per
the user's decision, SENTINEL **ports the relevant source code** from those
packages into itself (no `file:` dependency, no shared published package),
keeping the project self-contained.

`ANTHROPIC_API_KEY` is available in the environment; Node 22 is the active
version.

Artifact convention: this project uses the `docs/superpowers/specs/`
convention (like `projects/lumosuite`), not the workspace-level OpenSpec
`contract-driven` schema — that schema is specific to the OpenCode/subagent
flow and does not apply to this Claude Code session.

All project content — code, comments, CLI copy, finding evidence strings,
judge prompts, docs — is written in English.

## Goals / Non-Goals

**Goals:**

- Automatically audit a multi-repository release with no manual catalog of
  participating applications.
- Discover repositories recursively under `services/` and `webapps/`
  (plain directories or already-initialized git submodules).
- Correctly pick the base tag by ancestry + real SemVer comparison (never
  lexical), including the old-line patch scenario.
- Deterministically detect 6 categories of operational change (environment,
  database, aws, messaging, integration, infrastructure) with file/line
  evidence, never secrets.
- Read and validate the `release-documents/<release>/` structure
  (env-vars.md, instructions.md, scripts/<application>/), checking
  reference consistency.
- Use local-first RAG (never send a whole repository to an external
  provider) to assemble context per finding.
- Use a provider-agnostic LLM-as-judge to decide documentation coverage,
  with Zod-validated output and mandatory citations.
- Generate `report.json` and `report.md` under `artifacts/<release>/`.
- Orchestrate everything via LangGraph, small and deterministic nodes.
- `--dry-run` always exits successfully; without it, exit code is non-zero
  when there is a `missing` pending item.

**Non-Goals (this POC):**

- No manual catalog/manifest of applications or versions.
- No release-tag writing by default (a real `ReleaseMarker` is out of
  scope; only the interface + `DryRunReleaseMarker`).
- No execution of release scripts.
- No autonomous/multi-agent system, Redmine, Metabase, real AWS SDK, or web
  UI.
- No "real" incremental indexing (the POC reindexes everything on every
  run; the incremental-by-hash state *model* is prepared but not
  optimized).

## Decisions

### D-01 — YandeCode reuse via narrow-scope source porting

Ports into `src/rag/vendor/` only:

- From `@yandecode/retrieval`: `chunking/*` (Line/Markdown/TreeSitter/
  Router), `embeddings/*` (Arctic + Hash fallback), `fusion/*` (RRF/MMR/
  boosts), `lexical/identifiers`, `vector/usearch-index` + `types`,
  `service/hybrid-retriever`, `service/indexing-service`.
- From `@yandecode/core`: only the document/chunk persistence slice
  (`persistence/open.ts`, `state-service.ts`, `fts-query.ts`, `vectors.ts`,
  `repositories/documents.ts`, an adapted initial migration) plus `ids.ts`
  and `security/hash.ts`.

`sessions`, `events`, `memories`, `swarms`, `tasks`, `leases`, `messages`,
`workspaces` are **not** ported — they belong to YandeCode's agent system
and have no role here (YAGNI). The ported SQL schema drops the
`sessions`/`events` tables and extends `documents` with `repository`,
`application`, `source` to match `RagDocumentMetadata`. Every ported file
carries a one-line origin comment pointing at
`projects/yandecode/packages/<pkg>/src/<path>`, documenting the integration
point in case the package is consumed as a dependency again in the future.

Rejected alternative: a direct `file:` dependency — simpler, but the user
explicitly asked for a self-contained POC project.
Rejected alternative: reimplementing from scratch — unacceptable schedule
risk for a next-day demo.

### D-02 — Base-tag resolution: real SemVer, git ancestry

Applications under `services/`/`webapps/` use **SemVer tags only**
(`vX.Y.Z`). `RYYYY.NN` is reserved for the release name (`--release`), and
is never looked up as a tag inside an application repository.

The `ReleaseTagMatcher` interface stays pluggable (room to extend later),
but the only implementation used in this POC is `SemverTagMatcher`.
Per-repository algorithm:

1. List tags and filter to those matching `vX.Y.Z` **and** that are
   ancestors of the target commit (`git merge-base --is-ancestor`).
2. Sort the ancestral tags by structured semantic version (a real SemVer
   parser, never `localeCompare`/string sort).
3. Pick the highest one. If no ancestral tag matches, classify the
   repository as `first_release` and use `git rev-list --max-parents=0
   HEAD` as the base, recording this condition in the report.
4. Compute `git log <base>..<head>` and `git diff <base>..<head>`. No
   commits → the application is left out of the main report (but still
   counted under "repositories analyzed").

This guarantees that, on `patch/1.0` with history `v1.0.0 → patch
commits`, `v2.0.0` (present only on `main`) never enters the candidate
list, because it fails the ancestry test before version comparison even
happens.

### D-03 — Deterministic detectors, no LLM

Each category is an independent, testable `ChangeDetector` class, operating
only on files changed in the diff:

- `environment-detector`: parses keys in `application*.yml/yaml/
  properties`, `.env.example`, Helm `values*.yaml`, Docker Compose,
  manifests — diffs keys (never values), never indexes or prints a secret
  value.
- `migration-detector` (database): new/changed Flyway/Liquibase migrations
  + SQL scripts applied by the application itself.
- `aws-detector`, `messaging-detector`, `integration-detector`,
  `infrastructure-detector`: pattern-based rules (SDK calls, resource
  names, topics/queues, URLs/certificates, Terraform/CloudFormation/Helm/
  K8s/Compose files).

All of them emit a `Finding` in the contract's shape, using precise
language ("new reference detected", "provisioning not verified" — never
asserting that a resource "needs to be created" just because the code
references it).

### D-04 — Release documents: structured reader + consistency checks

`ReleaseDocumentReader` builds a `ReleaseDocumentBundle`. Rules:

- `env-vars.md` and `instructions.md` are required; their absence is
  reported as a package pending item (it does not block the audit, but
  shows up in the report).
- `scripts/` is optional, except when a detector signals a need for
  operational execution (e.g. `migration-detector` fired) — in that case
  its absence produces an explained `inconclusive`, not a silent `missing`.
- `kind` classification (`sql`/`mongo`/`shell`/`unknown`) by content:
  heuristics (`CREATE TABLE`/`ALTER TABLE`/`INSERT INTO` → sql; `db.` +
  `.insertMany`/`.updateMany`/`use <db>` → mongo; shebang → shell), never
  extension alone.
- Every `scripts/<application>/...` reference in `instructions.md` must
  point at an existing file (`referencedByInstructions`); a broken
  reference becomes a pending item.
- A script present but not cited in `instructions.md` → `inconclusive`
  ("may not be scheduled for execution").
- A script from one application never covers a finding from a different
  application.

Scripts are never executed — only read, classified, and cited.

### D-05 — Provider-agnostic LLM-as-judge

Contract: `DocumentationJudge` accepts a `BaseChatModel`
(`@langchain/core`), not a concrete implementation. An infrastructure
resolver picks the default implementation based on whichever environment
variable is available (`ANTHROPIC_API_KEY` → `@langchain/anthropic`, model
`claude-sonnet-5`); nothing in the domain or the graph nodes depends on the
concrete provider — switching providers means swapping the resolver, not
the service.

The judge receives only the `DocumentationJudgementInput` package (finding
+ bounded deterministic evidence + deterministic-search candidates + RAG
hits), never the whole repository, and never runs tools. Output is
Zod-validated against `DocumentationJudgement`. Prompt rules (unchanged
from the original brief): `documented` only with sufficient citation; a
vague mention does not count as coverage; code/KB snippets provide context
but never substitute for the release document; insufficient/contradictory
evidence → `inconclusive`; `missing` requires explaining what's missing;
every conclusion cites the file+lines it was given.

Provider failure, invalid JSON after 2 retries, or lack of relevant context
→ always `inconclusive` with a technical reason, never `documented`. This
is enforced by a dedicated test (see Testing).

### D-06 — LangGraph orchestration

State typed in `graph/audit-state.ts`; nodes in `graph/audit-graph.ts`:

```
validate_input -> discover_repositories -> analyze_repositories
  -> load_release_documents -> retrieve_context -> judge_documentation
  -> render_report -> finish
```

- `validate_input`: validates args with Zod (release, workspace, dry-run,
  mark-released), checks that `release-documents/<release>/` exists.
- `discover_repositories`: recursive `RepositoryDiscovery`.
- `analyze_repositories`: per repository, resolves the base (D-02), runs
  the 6 detectors (D-03); parallelized with a configurable concurrency
  limit (a small hand-rolled pool, no new dependency).
- `load_release_documents`: `ReleaseDocumentReader` (D-04); ensures a
  usable RAG index (runs `index` if needed) and reports file/chunk counts.
- `retrieve_context`: only processes findings already validated by the
  detectors; deterministic per-category search (per the brief's table) +
  hybrid RAG filtered by `application`/`source`/`gitCommit`.
- `judge_documentation`: calls the judge (D-05) finding by finding.
- `render_report`: `ReportWriter` generates `report.json` + `report.md`.
- `finish`: decides the exit code (`--dry-run` always 0; otherwise non-zero
  if there is a `missing` finding).

### D-07 — CLI and ReleaseMarker

`commander`, three commands:

- `sentinel audit --release <r> --workspace <path> [--dry-run]
  [--mark-released]`
- `sentinel index --workspace <path>`
- `sentinel rag search --workspace <path> --query "<q>"`

`ReleaseMarker` is an interface; `DryRunReleaseMarker` lists which
repositories would receive the tag (only those with new commits, only if
the audit finishes with no blocking pending items) without writing
anything. A real implementation is out of scope for this POC — future
activation sits behind an explicit flag.

## Risks / Trade-offs

- **Source porting instead of a dependency**: duplicates ~1.8k lines from
  YandeCode inside SENTINEL; mitigated with a per-file origin comment and a
  narrow scope (only what's needed).
- **Full depth across all 6 detectors + a full RAG port** significantly
  raises the amount of work for a next-day delivery; mitigated by
  prioritizing fixtures and tests on the paths the acceptance criteria
  actually exercise (environment/database), while keeping the other 4
  detectors real but with fewer test cases.
- **A real LLM judge in automated tests** costs time/money/tokens; the
  judgement tests use a deterministic `FakeListChatModel` from
  `@langchain/core/utils/testing` for the `documented`/`missing`/
  `inconclusive` cases plus a dedicated provider-failure/invalid-JSON test.
  An optional smoke test against the real provider (gated by
  `ANTHROPIC_API_KEY`) stays outside the default `npm test` run.
- **Sandbox environment** may lack network access to download the
  Snowflake Arctic embedding model on first run; the ported
  `HashEmbeddingProvider` serves as a deterministic fallback for tests,
  while `index`/`audit` try the real Arctic provider first.

## Migration Plan

No migration — new project. Implementation order (detailed in the
implementation plan written next): domain contracts → git/tags →
detectors → release documents → ported RAG → judge → LangGraph graph →
CLI → report writer → fixtures → end-to-end tests → `npm test`/
`typecheck`/demo `--dry-run`.

## Testing

- Automatic repository discovery (plain dirs and submodule).
- Picking the highest ancestral SemVer tag from HEAD; `patch/1.0` case
  proving that `v2.0.0` from `main` is never chosen.
- `first_release` when there is no ancestral tag.
- At least one environment `Finding` and one database `Finding` per
  fixture.
- `DocumentationJudge`: `documented`, `missing`, `inconclusive` with a fake
  chat model, plus provider failure/invalid JSON → always `inconclusive`.
- Reading `env-vars.md`/`instructions.md`/scripts segregated by
  application; existing and missing script references.
- Hybrid retrieval (RAG) of a documentation snippet related to a finding;
  filtering by `application` and `source`.
- Generating `report.json`/`report.md`.
- `--dry-run` behavior (always success) vs. no flag (non-zero exit code
  with a `missing` finding).

## Acceptance Criteria (inherited from the original brief)

See the "Acceptance criteria for tomorrow" section of the original request
— all mapped to the tests above and verified manually by running
`sentinel audit --release R2026.12 --workspace <fixtures> --dry-run` before
delivery.
