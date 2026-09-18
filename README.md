<a id="readme-top"></a>

<div align="center">
  <img src=".github/assets/logo.png" alt="SENTINEL" width="160" height="160" />

  <h1>SENTINEL</h1>

  <p>
    <strong>System for Engineering Notifications, Triage, Intelligence, Evidence and Lifecycle.</strong>
  </p>

  <p>
    Automatic release-check auditing for multi-repository applications.
    Discovers repositories, finds the operational changes that haven't
    shipped yet, and verifies — with deterministic rules, local RAG, and an
    LLM-as-judge — whether they're properly described in the release
    documents.
  </p>

  <p>
    <a href="#how-it-works"><strong>How it works</strong></a>
    &middot;
    <a href="#project-layout">Layout</a>
    &middot;
    <a href="#usage"><strong>Usage</strong></a>
    &middot;
    <a href="#development">Development</a>
    &middot;
    <a href="docs/superpowers/specs/2026-09-18-sentinel-poc-design.md">Design spec</a>
  </p>
</div>

> **Status:** proof of concept, in implementation. This README describes the
> intended CLI contract; see the
> [design spec](docs/superpowers/specs/2026-09-18-sentinel-poc-design.md)
> for the architecture decisions behind it.

## Why SENTINEL exists

A release made up of many repositories is hard to audit by hand: someone
has to remember which applications are part of it, review every unreleased
commit for a new environment variable, migration, cloud resource, or
changed integration, and manually cross-check that against what was
documented for operations. SENTINEL automates that audit **without** a
manual catalog of participating applications — it figures that out on its
own, straight from git.

## How it works

1. **Discovery** — finds git repositories recursively under `services/`
   and `webapps/` (plain directories or already-initialized submodules).
   No manual application list.
2. **Base resolution** — for each repository, finds the highest SemVer tag
   that is an *ancestor* of the target commit (never by text comparison),
   diffs it against HEAD, and only audits applications with new commits.
3. **Deterministic detection** — six detectors (environment, database,
   aws, messaging, integration, infrastructure) look for real evidence in
   the diff — file, line, snippet — without relying on an LLM to establish
   facts from git or code.
4. **Release documents** — reads and validates
   `release-documents/<release>/` (`env-vars.md`, `instructions.md`,
   `scripts/<application>/`), checking that every script reference cited
   in the instructions actually exists.
5. **Local-first RAG** — retrieves context (code, release documentation,
   knowledge base) per finding using hybrid search (BM25 + vector), running
   entirely locally — the repository is never sent whole to an external
   provider.
6. **LLM-as-judge** — evaluates, finding by finding, whether the release
   document covers the detected operational obligation, with a verdict
   (`documented` / `missing` / `inconclusive`), confidence, and mandatory
   citations.
7. **Report** — generates `report.json` (structured) and `report.md`
   (human-readable, ready to attach to a change request) under
   `artifacts/<release>/`.

## Project layout

SENTINEL is a monorepo (npm workspaces). Audit logic lives in a domain
package separate from the CLI, so a future API or web UI can reuse it
without duplicating code:

```
sentinel/
├── packages/
│   ├── core/    # domain, detectors, RAG, LangGraph graph, services — no terminal I/O
│   └── cli/     # `sentinel` command, depends on @sentinel/core
├── fixtures/    # demo/test workspaces (local git repositories)
├── artifacts/   # generated reports (git-ignored)
└── docs/        # design specs
```

## Usage

```bash
# ensure a usable RAG index exists for the workspace
sentinel index --workspace /path/to/workspace

# audit a release
sentinel audit --release R2026.12 --workspace /path/to/workspace --dry-run

# query the RAG directly
sentinel rag search --workspace /path/to/workspace --query "where is the receipts bucket configured?"
```

`--dry-run` always exits successfully (useful for demos); without the flag,
the command exits with a non-zero code when there is a `missing` pending
item. No tag, repository, or document is ever modified during an audit —
`--mark-released` is reserved for a future, explicit implementation.

## Development

```bash
npm install
npm test
npm run typecheck
```

Requires Node 22+. The LLM-as-judge provider is resolved from whichever
environment variable is available (today, `ANTHROPIC_API_KEY`) behind a
provider-agnostic interface — switching providers never requires a domain
change.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
