<a id="readme-top"></a>

<div align="center">
  <img src=".github/assets/logo.png" alt="Sentinela" width="160" height="160" />

  <h1>Sentinela</h1>

  <p>
    <strong>Auditoria automática de release check para aplicações multi-repositório.</strong>
  </p>

  <p>
    Descobre repositórios, encontra as mudanças operacionais que ainda não
    foram liberadas e verifica — com regras determinísticas, RAG local e um
    LLM-as-judge — se elas estão devidamente descritas nos documentos da
    release.
  </p>

  <p>
    <a href="#como-funciona"><strong>Como funciona</strong></a>
    &middot;
    <a href="#estrutura-do-projeto">Estrutura</a>
    &middot;
    <a href="#uso"><strong>Uso</strong></a>
    &middot;
    <a href="#desenvolvimento">Desenvolvimento</a>
    &middot;
    <a href="docs/superpowers/specs/2026-09-18-sentinela-poc-design.md">Design spec</a>
  </p>
</div>

> **Status:** prova de conceito em implementação. Este README descreve o
> contrato pretendido da CLI; consulte a
> [design spec](docs/superpowers/specs/2026-09-18-sentinela-poc-design.md)
> para as decisões de arquitetura por trás dele.

## Por que o Sentinela existe

Uma release composta por muitos repositórios é difícil de auditar à mão:
alguém precisa lembrar quais aplicações participam, revisar cada commit não
liberado atrás de variável de ambiente nova, migration, recurso de nuvem ou
integração alterada, e cruzar isso manualmente com o que foi documentado
para a operação. O Sentinela automatiza essa auditoria **sem** catálogo
manual de aplicações participantes: ele descobre isso sozinho a partir do
próprio git.

## Como funciona

1. **Descoberta** — encontra repositórios git recursivamente em
   `services/` e `webapps/` (diretórios comuns ou submódulos já
   inicializados). Nenhuma lista manual de aplicações.
2. **Resolução de base** — para cada repositório, encontra a maior tag
   SemVer que seja *ancestral* do commit alvo (nunca por comparação de
   texto), calcula o diff até o HEAD e só audita quem tem commits novos.
3. **Detecção determinística** — seis detectores (environment, database,
   aws, messaging, integration, infrastructure) procuram evidência real no
   diff — arquivo, linha, trecho — sem depender de LLM para constatar fatos
   do git ou do código.
4. **Documentos da release** — lê e valida `release-documents/<release>/`
   (`env-vars.md`, `instructions.md`, `scripts/<aplicacao>/`), checando que
   toda referência a script citada nas instruções realmente existe.
5. **RAG local-first** — recupera contexto (código, documentação da release,
   base de conhecimento) por achado usando busca híbrida (BM25 + vetorial)
   rodando inteiramente local — o repositório nunca é enviado inteiro a um
   provider externo.
6. **LLM-as-judge** — avalia, achado a achado, se o release document cobre a
   obrigação operacional detectada, com veredito (`documented` /
   `missing` / `inconclusive`), confiança e citações obrigatórias.
7. **Relatório** — gera `report.json` (estruturado) e `report.md` (legível,
   pronto para anexar à GMUD) em `artifacts/<release>/`.

## Estrutura do projeto

O Sentinela é um monorepo (npm workspaces). A lógica de auditoria vive num
pacote de domínio separado da CLI, para que uma futura API ou interface web
possam reutilizá-la sem duplicar código:

```
sentinela/
├── packages/
│   ├── core/    # domínio, detectores, RAG, grafo LangGraph, serviços — sem I/O de terminal
│   └── cli/     # comando `sentinela`, depende de @sentinela/core
├── fixtures/    # workspaces de demonstração/teste (repositórios git locais)
├── artifacts/   # relatórios gerados (git-ignored)
└── docs/        # specs de design
```

## Uso

```bash
# garante um índice RAG utilizável para o workspace
sentinela index --workspace /caminho/para/workspace

# audita uma release
sentinela audit --release R2026.12 --workspace /caminho/para/workspace --dry-run

# consulta o RAG diretamente
sentinela rag search --workspace /caminho/para/workspace --query "onde é configurado o bucket de recibos?"
```

`--dry-run` sempre termina com sucesso (útil para demonstração); sem a
flag, o comando termina com código de saída diferente de zero quando há
pendência `missing`. Nenhuma tag, repositório ou documento é alterado durante
a auditoria — `--mark-released` fica reservado para uma implementação futura
explícita.

## Desenvolvimento

```bash
npm install
npm test
npm run typecheck
```

Requer Node 22+. O provedor do LLM-as-judge é resolvido por variável de
ambiente disponível (hoje, `ANTHROPIC_API_KEY`) atrás de uma interface
agnóstica de provedor — trocar de provedor não exige mudança no domínio.

<p align="right">(<a href="#readme-top">voltar ao topo</a>)</p>
