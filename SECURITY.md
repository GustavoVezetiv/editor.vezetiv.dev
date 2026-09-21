# Segurança — Editor Vezetiv

## Modos e identidades

O modo de execução é explícito:

- `VITE_APP_MODE=demo`: somente dados fictícios no `localStorage`, com selo visível de demonstração.
- `VITE_APP_MODE=supabase`: Supabase obrigatório e sem fallback local. O navegador recebe apenas URL e chave pública `anon`.

O frontend resolve um `Actor`: `anonymous`, `student` ou `teacher`. Aluno usa `signInAnonymously()` e só é vinculado a um registro após `join_student` validar turma + código individual. Professor usa magic link (`signInWithOtp`, `shouldCreateUser: false`). Uma sessão docente permanente não pode entrar como aluno.

Os códigos individuais existem somente como hash bcrypt em `private.student_access_codes`. O valor aberto é mostrado ao professor apenas na criação/redefinição; redefinir também desvincula a sessão anônima anterior.

O código usa 12 caracteres de um alfabeto de 32 símbolos (aproximadamente 60 bits) e funciona como credencial. Um login válido em outro navegador assume o vínculo; por RLS, a sessão anterior perde acesso. A resposta de falha não diferencia turma, aluno ou código inválido.

## Integridade do score

O navegador executa `verifyActivity` apenas para feedback imediato. No modo Supabase, a Edge Function `verify-document` ignora score, resultados, atividade e conteúdo enviados pelo cliente: recebe apenas IDs, lê Activity e Document oficiais, executa a mesma engine e grava por uma RPC exclusiva do `service_role`. O papel `authenticated` não pode atualizar `attempts.current_score`, `score_reached_at`, inserir `verification_runs` nem concluir por UPDATE.

O bloqueio de colagem é somente um controle pedagógico de UI. A fronteira antifraude é a verificação oficial server-side.

## Matriz de autorização

| Ação | Sem sessão | Aluno | Professor |
| --- | --- | --- | --- |
| Abrir painel docente | Não | Não | Somente suas turmas |
| Ler estudante | Não | Somente o próprio perfil | Somente alunos de suas turmas |
| Ler/gravar tentativa | Não | Somente a própria; concluída é imutável | Somente leitura das suas turmas |
| Ler colegas / tentativas alheias | Não | Não | Apenas da turma possuída |
| Ranking | Não | RPC: top 5 + a própria posição, sem IDs | Não usado no painel |
| Criar turma/aluno/atividade | Não | Não | RPC autorizada e escopada ao professor |
| Alterar requisito após tentativas | Não | Não | Bloqueado |

As tabelas do Data API têm grants mínimos e RLS. Operações administrativas usam funções `security definer` com `search_path` vazio, autorização interna, `REVOKE` de `public/anon` e `GRANT EXECUTE` apenas para `authenticated`.

## Privacidade do ranking

O cliente do aluno não consulta a tabela de colegas nem tentativas alheias. `get_activity_ranking` retorna somente nome de exibição, score, instante do score, posição e indicador da posição atual. A saída contém o top 5 e o próprio aluno, caso esteja fora do top 5.

## Antes da produção

- Aplicar todas as migrações incrementais no projeto Supabase correto e executar testes de RLS com três identidades: anônima sem vínculo, aluno e professor.
- Provisionar professores no Auth e em `teacher_profiles`; a primeira turma será vinculada por `classes.teacher_id` ao ser criada.
- Habilitar Anonymous Sign-Ins e configurar URLs permitidas para o magic link.
- Configurar CAPTCHA (Turnstile/hCaptcha) e revisar o rate limit nativo de anonymous sign-ins; o padrão atual é 30/hora/IP.
- Nunca colocar `service_role`, SMTP secreto ou credenciais administrativas em variáveis `VITE_*`.
- Validar backup, retenção e base legal antes de armazenar dados reais de menores.
