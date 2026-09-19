# Arquitetura — Editor Vezetiv

```mermaid
flowchart LR
  S[Estudante] --> J[/join]
  J --> H[Área do estudante]
  H --> W[Workspace da atividade]
  W --> E[Editor Tiptap]
  W --> V[Engine de requisitos]
  V --> R[Resultado, feedback e score]
  W --> L[Repositório local / localStorage]
  L --> P[Camada de sincronização]
  P -. configurado e autenticado .-> DB[(Supabase)]
  T[Professor] --> D[/teacher]
  D --> L
```

## Núcleos

- `src/types`: contrato de atividade, tentativa, documento, requisito e ranking.
- `src/config`: atividades publicadas de referência.
- `src/verification`: registro de handlers por tipo de requisito; cada handler retorna aprovação, detalhe e feedback.
- `src/activity` e `src/editor`: interação do estudante e persistência com debounce.
- `src/services/localPlatformRepository.ts`: fonte local de verdade, dados demo e ranking determinístico.
- `src/services/platformRepository.ts`: grava local primeiro e sincroniza de forma assíncrona quando Supabase estiver configurado.

## Persistência e falhas

O navegador recebe a gravação local antes da sincronização. A interface mostra “Salvando”, “Sincronizado”, “Salvo neste dispositivo” ou “nova tentativa pendente”. Assim, uma falha de rede não descarta o documento; ela apenas mantém a cópia remota pendente para a próxima gravação.

## Rotas

| Rota | Finalidade |
| --- | --- |
| `/` ou `/student` | Área do estudante autenticado localmente |
| `/join` | Entrada na turma |
| `/activity/:slug` | Recupera ou cria a tentativa da atividade |
| `/teacher` | Painel docente |
