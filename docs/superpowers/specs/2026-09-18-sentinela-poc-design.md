# Sentinela Release Check — POC Design

## Context

Sentinela é uma CLI TypeScript interna que audita, antes da liberação de uma
release composta por múltiplos repositórios, se as mudanças operacionais
presentes nos commits ainda não liberados de cada aplicação estão descritas
nos documentos da release. Não existe fluxo, catálogo ou código anterior no
workspace para isso — é um projeto novo, independente, em
`projects/sentinela`.

O workspace já contém `projects/yandecode`, com `@yandecode/core` e
`@yandecode/retrieval` compilados (`dist/` presente), implementando
exatamente a arquitetura de RAG local-first pedida (SQLite FTS5/BM25 +
USearch HNSW + `@huggingface/transformers` + RRF + MMR + chunking
Tree-sitter/Markdown). Por decisão do usuário, o Sentinela **porta código-fonte
relevante** desses pacotes para dentro de si (não usa `file:` dependency nem
publica um pacote compartilhado), mantendo o projeto autocontido.

`ANTHROPIC_API_KEY` está disponível no ambiente; Node 22 é a versão ativa.

Convenção de artefatos: este projeto usa a convenção `docs/superpowers/specs/`
(como `projects/lumosuite`), não o schema `contract-driven` do OpenSpec de
nível de workspace — esse schema é específico do fluxo OpenCode/subagentes e
não se aplica a esta sessão baseada em Claude Code.

## Goals / Non-Goals

**Goals:**

- Auditar automaticamente uma release multi-repositório sem catálogo manual
  de aplicações participantes.
- Descobrir repositórios recursivamente em `services/` e `webapps/`
  (diretórios comuns ou submódulos git já inicializados).
- Escolher corretamente a tag-base por ancestralidade + comparação SemVer
  real (nunca lexical), inclusive no cenário de patch em linha antiga.
- Detectar deterministicamente 6 categorias de mudança operacional
  (environment, database, aws, messaging, integration, infrastructure) com
  evidência de arquivo/linha, nunca segredos.
- Ler e validar a estrutura de `release-documents/<release>/` (env-vars.md,
  instructions.md, scripts/<aplicacao>/), checando consistência de
  referências.
- Usar RAG local-first (não enviar repositório inteiro a um provider externo)
  para montar contexto por achado.
- Usar um LLM-as-judge independente de provedor para decidir cobertura
  documental, com saída validada por Zod e citações obrigatórias.
- Gerar `report.json` e `report.md` em `artifacts/<release>/`.
- Orquestrar tudo via LangGraph, nós pequenos e determinísticos.
- `--dry-run` sempre sai com sucesso; sem `--dry-run`, saída ≠ 0 quando há
  pendência `missing`.

**Non-Goals (desta POC):**

- Nenhum catálogo/manifesto manual de aplicações ou versões.
- Nenhuma escrita de tag de release por padrão (`ReleaseMarker` real fica
  fora de escopo; só a interface + `DryRunReleaseMarker`).
- Nenhuma execução de scripts de release.
- Nenhum agente autônomo/multiagente, Redmine, Metabase, AWS SDK real ou UI
  web.
- Nenhuma indexação incremental "de verdade" (a POC reindexa tudo a cada
  execução; o *modelo* de estado incremental por hash é preparado mas não
  otimizado).

## Decisions

### D-01 — Reuso do YandeCode por porte de código, escopo estreito

Porto para `src/rag/vendor/` apenas:

- De `@yandecode/retrieval`: `chunking/*` (Line/Markdown/TreeSitter/Router),
  `embeddings/*` (Arctic + Hash fallback), `fusion/*` (RRF/MMR/boosts),
  `lexical/identifiers`, `vector/usearch-index` + `types`,
  `service/hybrid-retriever`, `service/indexing-service`.
- De `@yandecode/core`: só a fatia de persistência de documentos/chunks
  (`persistence/open.ts`, `state-service.ts`, `fts-query.ts`, `vectors.ts`,
  `repositories/documents.ts`, migração inicial adaptada) + `ids.ts` e
  `security/hash.ts`.

Não porto `sessions`, `events`, `memories`, `swarms`, `tasks`, `leases`,
`messages`, `workspaces` — são do sistema de agentes do YandeCode, sem papel
aqui (YAGNI). O schema SQL portado remove as tabelas `sessions`/`events` e
estende `documents` com `repository`, `application`, `source` para casar com
`RagDocumentMetadata`. Cada arquivo portado leva um comentário de uma linha
apontando a origem (`projects/yandecode/packages/<pkg>/src/<path>`), servindo
de ponto de integração documentado caso o pacote volte a ser consumido via
dependência no futuro.

Alternativa rejeitada: dependência `file:` direta — mais simples, mas o
usuário pediu explicitamente um projeto autocontido para a POC.
Alternativa rejeitada: reimplementar do zero — risco de prazo inaceitável
para uma demonstração no dia seguinte.

### D-02 — Resolução de tag-base: SemVer real, ancestralidade via git

Aplicações em `services/`/`webapps/` usam **somente tags SemVer** (`vX.Y.Z`).
`RYYYY.NN` é reservado para o nome da release (`--release`), não é buscado
como tag em repositório de aplicação.

Interface `ReleaseTagMatcher` fica pluggable (permite estender no futuro),
mas a única implementação usada nesta POC é `SemverTagMatcher`. Algoritmo por
repositório:

1. `git tag --merged HEAD` (ou `git tag` + `git merge-base --is-ancestor`
   por candidata) filtra tags que casam com `vX.Y.Z` **e** são ancestrais do
   commit alvo.
2. Ordena as ancestrais por versão semântica estruturada (usando um parser
   SemVer, nunca `localeCompare`/ordenação de string).
3. Escolhe a maior. Se nenhuma ancestral válida existir, classifica como
   `first_release` e usa `git rev-list --max-parents=0 HEAD` como base,
   registrando essa condição no relatório.
4. Calcula `git log <base>..<head>` e `git diff <base>..<head>`. Sem commits
   → aplicação fica fora do relatório principal (mas conta em "aplicações
   analisadas").

Isso garante que, em `patch/1.0` com histórico `v1.0.0 → commits do patch`,
`v2.0.0` (presente só em `main`) nunca entra na lista de candidatas, porque
falha o teste de ancestralidade antes mesmo da comparação de versão.

### D-03 — Detectores determinísticos, sem LLM

Cada categoria é uma classe `ChangeDetector` independente e testável,
operando só sobre arquivos alterados no diff:

- `environment-detector`: parse de chaves em `application*.yml/yaml/properties`,
  `.env.example`, Helm `values*.yaml`, Docker Compose, manifests — diff de
  chaves (não de valores), nunca indexa/imprime valor de segredo.
- `migration-detector` (database): migrations Flyway/Liquibase novas/alteradas
  + scripts SQL aplicados pela própria aplicação.
- `aws-detector`, `messaging-detector`, `integration-detector`,
  `infrastructure-detector`: regras baseadas em padrões de referência
  (SDK calls, nomes de recurso, tópicos/filas, URLs/certificados, arquivos
  Terraform/CloudFormation/Helm/K8s/Compose).

Todos emitem `Finding` no formato do contrato do metaprompt, com linguagem
precisa ("referência nova detectada", "provisionamento não verificado" —
nunca afirmar que um recurso "precisa ser criado" só porque o código o
referencia).

### D-04 — Release documents: leitor estruturado + verificação de consistência

`ReleaseDocumentReader` monta `ReleaseDocumentBundle`. Regras:

- `env-vars.md` e `instructions.md` são obrigatórios; ausência é reportada
  como pendência do pacote (não trava a auditoria, mas aparece no relatório).
- `scripts/` é opcional, exceto quando algum detector indicar necessidade de
  execução operacional (ex.: `migration-detector` disparou) — nesse caso a
  ausência gera `inconclusive` explicado, não `missing` silencioso.
- Classificação de `kind` (`sql`/`mongo`/`shell`/`unknown`) por conteúdo:
  heurísticas (`CREATE TABLE`/`ALTER TABLE`/`INSERT INTO` → sql; `db.` +
  `.insertMany`/`.updateMany`/`use <db>` → mongo; shebang → shell), nunca só
  extensão.
- Toda referência `scripts/<aplicacao>/...` em `instructions.md` deve apontar
  para arquivo existente (`referencedByInstructions`); referência quebrada
  vira pendência.
- Script presente mas não citado em `instructions.md` → `inconclusive`
  ("pode não estar previsto para execução").
- Script de uma aplicação nunca cobre achado de outra aplicação.

Scripts nunca são executados — só lidos, classificados e citados.

### D-05 — LLM-as-judge independente de provedor

Contrato: `DocumentationJudge` recebe um `BaseChatModel` (`@langchain/core`),
não uma implementação concreta. Um resolver de infraestrutura escolhe a
implementação padrão por variável de ambiente disponível (`ANTHROPIC_API_KEY`
→ `@langchain/anthropic`, modelo `claude-sonnet-5`); nada no domínio ou nos
nós do grafo depende do provedor concreto — trocar para outro provider é
trocar o resolver, não o serviço.

O juiz recebe só o pacote `DocumentationJudgementInput` (achado + evidência
determinística delimitada + candidatos de busca determinística + hits do
RAG), nunca o repositório inteiro, e não executa ferramentas. Saída validada
com Zod contra `DocumentationJudgement`. Regras do prompt (do metaprompt,
sem alteração): `documented` só com citação suficiente; menção vaga não
cobre; trechos de código/KB contextualizam mas não substituem o release
document; insuficiente/contraditório → `inconclusive`; `missing` exige
explicar o que falta; toda conclusão cita arquivo+linhas fornecidos.

Falha do provider, JSON inválido após 2 retentativas, ou ausência de
contexto relevante → sempre `inconclusive` com motivo técnico, nunca
`documented`. Isso é reforçado por teste dedicado (ver Testing).

### D-06 — Orquestração LangGraph

Estado tipado em `graph/audit-state.ts`; nós em `graph/audit-graph.ts`:

```
validate_input -> discover_repositories -> analyze_repositories
  -> load_release_documents -> retrieve_context -> judge_documentation
  -> render_report -> finish
```

- `validate_input`: valida args com Zod (release, workspace, dry-run,
  mark-released), confere existência de `release-documents/<release>/`.
- `discover_repositories`: `RepositoryDiscovery` recursiva.
- `analyze_repositories`: por repositório, resolve base (D-02), roda os 6
  detectores (D-03); paralelizado com limite de concorrência configurável
  (implementação caseira de pool, sem dependência nova).
- `load_release_documents`: `ReleaseDocumentReader` (D-04); garante índice
  RAG utilizável (roda `index` se necessário) e reporta contagem de
  arquivos/chunks indexados.
- `retrieve_context`: só processa achados já validados pelos detectores;
  busca determinística por categoria (tabela do metaprompt) + RAG híbrido
  filtrado por `application`/`source`/`gitCommit`.
- `judge_documentation`: chama o juiz (D-05) achado a achado.
- `render_report`: `ReportWriter` gera `report.json` + `report.md`.
- `finish`: decide código de saída (`--dry-run` sempre 0; senão ≠ 0 se houver
  `missing`).

### D-07 — CLI e ReleaseMarker

`commander`, três comandos:

- `sentinela audit --release <r> --workspace <path> [--dry-run] [--mark-released]`
- `sentinela index --workspace <path>`
- `sentinela rag search --workspace <path> --query "<q>"`

`ReleaseMarker` é interface; `DryRunReleaseMarker` lista repositórios que
receberiam a tag (só os com commits novos, só se a auditoria terminar sem
pendência bloqueante) sem escrever nada. Implementação real fica fora de
escopo desta POC — ativação futura atrás de flag explícita.

## Risks / Trade-offs

- **Porte de código em vez de dependência**: duplica ~1.8k linhas do
  YandeCode dentro do Sentinela; mitigado com comentário de origem por
  arquivo e escopo estreito (só o necessário).
- **Profundidade total nos 6 detectores + porte completo do RAG** aumenta
  bastante o volume de trabalho para uma entrega no dia seguinte; mitigado
  priorizando fixtures e testes nos caminhos que os critérios de aceite
  realmente exercitam (environment/database), mantendo os outros 4
  detectores reais mas com menos casos de teste.
- **Juiz LLM real em teste automatizado** custa tempo/dinheiro e tokens; os
  testes de julgamento usam um `FakeChatModel` determinístico do
  `@langchain/core/utils/testing` para os casos `documented`/`missing`/
  `inconclusive` e um teste específico de falha/JSON inválido. Um teste
  opcional de fumaça com o provider real (gated por `ANTHROPIC_API_KEY`) fica
  fora do `npm test` padrão.
- **Ambiente sandbox** pode não ter rede para baixar o modelo de embeddings
  Snowflake Arctic na primeira execução; `HashEmbeddingProvider` (portado)
  serve de fallback determinístico para testes, e o `index`/`audit` tentam
  o Arctic real primeiro.

## Migration Plan

Não há migração — projeto novo. Ordem de implementação (detalhada no plano
de implementação a ser escrito a seguir): contratos de domínio → git/tags →
detectores → release documents → RAG portado → juiz → grafo LangGraph → CLI
→ report writer → fixtures → testes end-to-end → `npm test`/`typecheck`/
`--dry-run` de demonstração.

## Testing

- Descoberta automática de repositórios (dirs comuns e submódulo).
- Escolha da maior tag SemVer ancestral do HEAD; caso `patch/1.0` provando
  que `v2.0.0` de `main` nunca é escolhida.
- `first_release` quando não há tag ancestral.
- Pelo menos um `Finding` de environment e um de database por fixture.
- `DocumentationJudge`: `documented`, `missing`, `inconclusive` com
  `FakeChatModel`, mais falha de provider/JSON inválido → sempre
  `inconclusive`.
- Leitura de `env-vars.md`/`instructions.md`/scripts segregados por
  aplicação; referência existente e inexistente de script.
- Recuperação híbrida (RAG) de um trecho de documentação relacionado a um
  achado; filtro por `application` e `source`.
- Geração de `report.json`/`report.md`.
- Comportamento de `--dry-run` (sempre sucesso) vs. sem flag (código ≠ 0 com
  `missing`).

## Acceptance Criteria (herdados do metaprompt)

Ver seção "Critérios de aceite para amanhã" do pedido original — todos
mapeados nos testes acima e verificados manualmente rodando
`sentinela audit --release R2026.12 --workspace <fixtures> --dry-run` antes
da entrega.
