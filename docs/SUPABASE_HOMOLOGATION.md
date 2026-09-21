# Homologação Supabase — Editor Vezetiv

Este roteiro deve ser executado em um projeto Supabase inequivocamente identificado como o ambiente do Editor Vezetiv. Não use dados reais de alunos.

## Preparação

1. Aplique todas as migrations em ordem e publique `verify-document` mantendo `verify_jwt = true`.
2. Em Authentication, habilite Anonymous Sign-Ins. Mantenha o rate limit nativo (30/h/IP ou menor) e habilite Cloudflare Turnstile ou hCaptcha antes da produção.
3. Crie no Auth dois professores permanentes. Provisione apenas o Professor A:

```sql
insert into public.teacher_profiles (user_id, display_name, active)
values ('UUID_DO_PROFESSOR_A', 'Professor A', true);
```

4. Entre por magic link como Professor A, crie Turma A e confirme que essa é sua primeira turma. Provisione o Professor B e crie Turma B.
5. Cadastre Aluno A e Aluno B na Turma A e Aluno C na Turma B. Guarde cada código apenas para o teste.
6. Crie uma atividade publicada para cada turma e atribua uma janela disponível. Use clientes/sessões separados para cada identidade.

## Matriz obrigatória

| Caso | Procedimento | Resultado esperado |
| --- | --- | --- |
| Professor A × Turma B | Consultar `classes`, `students`, `attempts` e dashboard | Nenhuma linha da Turma B |
| Aluno A × Aluno B | Consultar `students` pelo ID de B | Zero linhas |
| Aluno A × tentativa B | Consultar/alterar `attempts` e `documents` de B | Zero linhas ou 403 |
| Score forjado | Fazer `update attempts set current_score=100` via Data API | Negado |
| VerificationRun forjado | Inserir `verification_runs` via Data API | Negado |
| Payload forjado | Invocar `verify-document` enviando também `score/results/content` falsos | Campos ignorados; resultado deriva do documento oficial |
| Ranking privado | Invocar `get_activity_ranking` como Aluno A | Somente Top 5 + A; sem IDs ou tentativas |
| Fora da janela | Invocar `start_attempt` para atividade indisponível | Erro genérico; nenhuma tentativa criada |
| Imutabilidade | Concluir e tentar alterar tentativa/documento | Negado; score e conteúdo permanecem |
| Rebind | Entrar em outro navegador com o mesmo código | Nova sessão assume; sessão anterior perde acesso por RLS |
| Reset | Professor redefine o código e a sessão anterior consulta dados | Acesso anterior negado; só o novo código funciona |
| Bootstrap | Professor provisionado sem turma chama `create_class_for_teacher` | Primeira turma criada |
| Não provisionado | Usuário Auth permanente sem `teacher_profiles.active` abre `/teacher` | Não recebe Actor professor nem painel |

## Fluxos oficiais

- `start_attempt(activity_id)` cria tentativa, documento e `activity_started` em uma transação.
- O editor salva somente documento, aba ativa e eventos de UI permitidos.
- `verify-document` aceita apenas IDs, lê Activity/Document oficiais, executa `verifyActivity` e usa `record_official_verification` via service role.
- `complete_attempt` confirma propriedade/tentativa aberta, define timestamps server-side e cria `activity_completed`.

## Segurança operacional

O código individual é uma credencial. Ao reutilizá-lo em outro navegador, o vínculo `students.auth_user_id` muda deliberadamente e a sessão anterior perde acesso. A mensagem pública de join permanece genérica para não revelar se turma ou aluno existem.

O bloqueio de colagem é um controle pedagógico da interface, não uma barreira antifraude. A integridade avaliada é a do score oficial, calculado server-side sobre o documento persistido.

Registre evidências de cada caso (identidade, horário, request e resultado), rode os advisors do Supabase e só então aprove a homologação.
