# Editor Vezetiv

Plataforma de aprendizagem prática de edição de documentos. O editor Tiptap é a infraestrutura; o produto é o ciclo **LER → ENTENDER → EXECUTAR → VERIFICAR → CORRIGIR → CONCLUIR**.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `/join` e use `DEMO` com um dos acessos individuais exibidos no seed (`ANA01`, por exemplo). A aplicação funciona sem serviços externos, persistindo dados fictícios no `localStorage`. O cabeçalho identifica claramente esse ambiente como **Modo de demonstração**.

## Arquitetura

- `Activity`: configuração reutilizável com ferramentas, política de colagem, preset, requirements, dicas e pontuação. Disponibilidade e destaque pertencem a `ClassActivity`, portanto são específicos de cada turma.
- Engine de verificação: um registro de handlers avalia nós reais do Tiptap (heading, alinhamento, marcas, listas, preset e conteúdo de texto) e retorna feedback acionável. Lista digitada manualmente não passa como `orderedList`/`bulletList`.
- `ActivityAttempt`: isola documentos, verificações, score e eventos de cada aluno por atividade.
- Repositories separados: `LocalPlatformRepository` atende a demonstração; `SupabasePlatformRepository` é a fonte de verdade quando existe sessão Supabase autenticada. A fachada escolhe uma implementação, sem combinar leituras locais e remotas.
- Autenticação: alunos usam sessão anônima Supabase vinculada por RPC a um código individual; professores usam magic link por e-mail. Um `Actor` explícito protege as rotas.
- Professor: `/teacher` permite selecionar a turma, gerenciar alunos e códigos, criar/editar/arquivar atividades, definir destaque/agendamento e consultar documentos, verificações e eventos.

## Atividades, dicas e score

Cada requirement possui objetivo, pontos e, quando necessário, uma dica procedural. Dicas nunca executam operações pelo aluno. A verificação manual preserva o último resultado e exige uma nova verificação depois de alterações. O score é a soma dos requirements atendidos.

O texto pode usar `exact`, `normalized` ou `similarity`; similaridade é local e determinística, sem IA ou API externa.

## Supabase

Copie `.env.example` para `.env.local` e preencha apenas chaves públicas:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_MODE=supabase
```

A migração inicial está em [supabase/migrations/20260919000000_learning_platform.sql](supabase/migrations/20260919000000_learning_platform.sql). As migrações seguintes são incrementais; a mais recente adiciona códigos com hash em schema privado, RPCs autorizadas e políticas por ator. Todas as tabelas expostas têm RLS habilitado e grants explícitos.

O modo é explícito. `VITE_APP_MODE=demo` nunca consulta Supabase; `VITE_APP_MODE=supabase` exige URL e chave pública válidas e não faz fallback silencioso. Professores precisam ser provisionados no Auth e vinculados por `classes.teacher_id`; estudantes são pré-cadastrados pelo professor e vinculados à sessão anônima no primeiro acesso válido.

## Testes

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

Os testes cobrem verificação estrutural, comparação exata/normalizada, marcas divididas em nós, score máximo entre documentos, IDs do construtor, exportação, storage, eventos e ranking. O Playwright cobre entrada do aluno, ausência de autoentrada e acesso docente demo.

Leia também [PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md) e [SECURITY.md](SECURITY.md) antes de configurar um ambiente remoto.
