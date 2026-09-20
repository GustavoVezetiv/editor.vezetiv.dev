# Editor Vezetiv

Plataforma de aprendizagem prática de edição de documentos. O editor Tiptap é a infraestrutura; o produto é o ciclo **LER → ENTENDER → EXECUTAR → VERIFICAR → CORRIGIR → CONCLUIR**.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `/join`, informe `DEMO` como código da turma e uma identificação própria. A aplicação funciona sem serviços externos, persistindo dados de demonstração no `localStorage` do navegador. Uma instalação nova já traz uma turma, cinco estudantes e três atividades com tentativas em estados variados para demonstrar o painel docente.

## Arquitetura

- `Activity`: configuração reutilizável com ferramentas, política de colagem, preset, requirements, dicas e pontuação. Disponibilidade e destaque pertencem a `ClassActivity`, portanto são específicos de cada turma.
- Engine de verificação: um registro de handlers avalia nós reais do Tiptap (heading, alinhamento, marcas, listas, preset e conteúdo de texto) e retorna feedback acionável. Lista digitada manualmente não passa como `orderedList`/`bulletList`.
- `ActivityAttempt`: isola documentos, verificações, score e eventos de cada aluno por atividade.
- Repositories separados: `LocalPlatformRepository` atende a demonstração; `SupabasePlatformRepository` é a fonte de verdade quando existe sessão Supabase autenticada. A fachada escolhe uma implementação, sem combinar leituras locais e remotas.
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

A migração inicial está em [supabase/migrations/20260919000000_learning_platform.sql](supabase/migrations/20260919000000_learning_platform.sql). As migrações seguintes adicionam índices e `class_activities`, estado remoto da tentativa e políticas por turma. Todas as tabelas expostas têm RLS habilitado e grants explícitos.

O frontend detecta uma sessão Supabase existente, mas ainda não oferece uma tela própria de login/cadastro. Sem sessão autenticada, a aplicação entra explicitamente em modo demo local. Para dados reais, a identidade de estudante/professor precisa ser provisionada em `auth.users` e relacionada às tabelas públicas.

## Testes

```bash
npm test
npm run lint
npm run build
```

Os testes cobrem verificação estrutural, texto normalizado/similaridade, score, presets, exportação, storage, eventos, tentativa e ranking local.

Leia também [PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md) e [SECURITY.md](SECURITY.md) antes de configurar um ambiente remoto.
