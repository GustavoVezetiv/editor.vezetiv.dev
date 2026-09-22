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
  F -->|VITE_APP_MODE=supabase| P[SupabasePlatformRepository]
  P --> DB[(Supabase)]
  T[Professor] --> A[Magic link]
  A --> D[/teacher]
  D --> F
```

## Núcleos

- `src/types`: contrato de atividade, tentativa, documento, requisito e ranking.
- `src/config`: atividades publicadas de referência.
- `src/verification`: registro de handlers por tipo de requisito; cada handler retorna aprovação, detalhe e feedback.
- `src/activity` e `src/editor`: interação do estudante e persistência com debounce.
- `src/services/localPlatformRepository.ts`: fonte de verdade somente do modo demo, dados seed e ranking determinístico por turma.
- `src/services/supabasePlatformRepository.ts`: leituras e gravações remotas, dependências ordenadas e outbox limitada.
- `src/services/authService.ts`: resolve o `Actor` (`anonymous`, `student` ou `teacher`) e concentra entrada/saída.
- `src/services/platformRepository.ts`: contrato e seleção explícita da implementação conforme `VITE_APP_MODE`.

## Persistência e falhas

No modo Supabase, o banco remoto é a fonte de verdade. Uma gravação que falha entra em uma outbox local limitada, retomada na inicialização e no próximo save. Dependências ausentes são marcadas como bloqueio e não entram em retry infinito. No modo demo, o `localStorage` continua sendo a fonte de verdade.

`Activity` contém apenas conteúdo reutilizável. Destaque e janela de disponibilidade vivem exclusivamente em `ClassActivity`. Score é o maior valor entre todas as verificações e documentos da tentativa; `scoreReachedAt` mantém a primeira vez em que esse máximo foi atingido.

## Rotas

| Rota | Finalidade |
| --- | --- |
| `/` ou `/student` | Área do estudante autenticado |
| `/join` | Entrada na turma |
| `/activity/:slug` | Recupera ou cria a tentativa da atividade |
| `/teacher` | Painel docente |
| `/teacher/login` | Solicitação de magic link do professor |
