# Segurança — Editor Vezetiv

## Situação atual

O modo padrão é local e demonstração: os dados residem no `localStorage` do navegador. Ele é adequado para prática e avaliação visual, não para dados pessoais reais ou uso compartilhado.

O cliente só lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; nenhuma chave `service_role` ou segredo é exposto ao navegador.

## Supabase e RLS

As migrações habilitam RLS em todas as tabelas públicas e associam acesso de estudante ao `auth.uid()` por `students.auth_user_id`. A migração incremental `20260919010000_add_learning_indexes.sql` apenas acrescenta índices; ela não reescreve a migração inicial.

O frontend ainda não implementa autenticação Supabase nem papel de professor. Por essa razão, o modo remoto não está homologado para dados reais: uma equipe deve conectar uma identidade autenticada, revisar grants do Data API e criar políticas específicas de professor antes de ativá-lo em produção.

## Checklist antes de produção

- Configurar login e associar cada estudante a `auth.users`.
- Revisar políticas com um usuário estudante e um usuário professor reais.
- Confirmar que as tabelas públicas expostas pelo Data API têm RLS e grants mínimos.
- Nunca inserir chaves secretas em `VITE_*`.
- Testar tentativas, documentos, verificações e eventos sob RLS antes de liberar a turma.
