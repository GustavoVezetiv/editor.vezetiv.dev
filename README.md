# Editor Vezetiv

Plataforma de aprendizagem prática de edição de documentos. O editor Tiptap é a infraestrutura; o produto é o ciclo **LER → ENTENDER → EXECUTAR → VERIFICAR → CORRIGIR → CONCLUIR**.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `/join`, informe `DEMO` como código da turma e uma identificação própria. A aplicação funciona sem serviços externos, persistindo dados de demonstração no `localStorage` do navegador.

## Arquitetura

- `Activity`: configuração reutilizável com slug, disponibilidade, destaque semanal, ferramentas, política de colagem, preset, requirements, dicas e pontuação.
- Engine de verificação: avalia nós reais do Tiptap (heading, alinhamento, marcas, listas, preset e conteúdo de texto). Lista digitada manualmente não passa como `orderedList`/`bulletList`.
- `ActivityAttempt`: isola documentos, verificações, score e eventos de cada aluno por atividade.
- Repositório local: permite o fluxo completo sem Supabase; a camada `src/services/supabase.ts` ativa o cliente quando as variáveis públicas estiverem configuradas.
- Professor: `/teacher` apresenta painel, tentativas, score, verificações, documento e timeline de eventos.

## Atividades, dicas e score

Cada requirement possui objetivo, pontos e, quando necessário, uma dica procedural. Dicas nunca executam operações pelo aluno. A verificação manual preserva o último resultado e exige uma nova verificação depois de alterações. O score é a soma dos requirements atendidos.

O texto pode usar `exact`, `normalized` ou `similarity`; similaridade é local e determinística, sem IA ou API externa.

## Supabase

Copie `.env.example` para `.env.local` e preencha apenas chaves públicas:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

A migração inicial está em [supabase/migrations/20260919000000_learning_platform.sql](supabase/migrations/20260919000000_learning_platform.sql). Ela define classes, alunos, atividades, tentativas, documentos, verificações e eventos, com RLS habilitado.

Ainda não há autenticação Supabase no frontend. Portanto, as políticas de professor ficam deliberadamente adiadas: não use o modo remoto para dados reais até conectar a identidade de aluno/professor a `auth.users` e revisar os grants e as políticas de docente.

## Testes

```bash
npm test
npm run lint
npm run build
```

Os testes cobrem verificação estrutural, texto normalizado/similaridade, score, presets, exportação, storage, eventos, tentativa e ranking local.
