# Arquitetura — Editor Vezetiv

```mermaid
flowchart LR
  S[Estudante] --> J[/join]
  J --> H[Área do estudante]
  H --> W[Workspace da atividade]
  W --> E[Editor Tiptap]
  W --> V[Engine de requisitos]
  V --> R[Resultado, feedback e score]
  W --> F[Fachada de repository]
  F -->|demo| L[LocalPlatformRepository]
  F -->|sessão autenticada| P[SupabasePlatformRepository]
  P --> DB[(Supabase)]
  T[Professor] --> D[/teacher]
  D --> L
```

## Núcleos

- `src/types`: contrato de atividade, tentativa, documento, requisito e ranking.
- `src/config`: atividades publicadas de referência.
- `src/verification`: registro de handlers por tipo de requisito; cada handler retorna aprovação, detalhe e feedback.
- `src/activity` e `src/editor`: interação do estudante e persistência com debounce.
- `src/services/localPlatformRepository.ts`: fonte de verdade somente do modo demo, dados seed e ranking determinístico por turma.
- `src/services/supabasePlatformRepository.ts`: leituras e gravações remotas, dependências ordenadas e outbox limitada.
- `src/services/platformRepository.ts`: contrato e seleção da implementação de acordo com a sessão.

## Persistência e falhas

No modo Supabase, o banco remoto é a fonte de verdade. Uma gravação que falha entra em uma outbox local limitada, retomada na inicialização e no próximo save. Dependências ausentes são marcadas como bloqueio e não entram em retry infinito. No modo demo, o `localStorage` continua sendo a fonte de verdade.

## Rotas

| Rota | Finalidade |
| --- | --- |
| `/` ou `/student` | Área do estudante autenticado localmente |
| `/join` | Entrada na turma |
| `/activity/:slug` | Recupera ou cria a tentativa da atividade |
| `/teacher` | Painel docente |
