# Editor Vezetiv

Protótipo frontend de um editor educacional para praticar competências de edição de documentos. A proposta é que a IA possa orientar o estudante, enquanto a execução das operações acontece no editor.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Arquitetura pedagógica

A `Activity` é a unidade central: ela declara objetivos, requisitos estruturais tipados, dicas procedurais, pontuação, ferramentas liberadas, política de colagem, preset e modo de verificação. O editor é a infraestrutura em que o aluno executa as operações.

As dicas apenas explicam o procedimento. A verificação é manual, preserva o último resultado após edições e indica quando é preciso verificar novamente. Eventos pedagógicos possuem modelo TypeScript isolado para uma futura integração de backend, sem serem acumulados no `localStorage`.

## Verificação técnica

```bash
npm run lint
npm run build
```

O MVP inclui atividade de formatação básica, autosave em `localStorage`, bloqueio configurável de colagem, verificação manual com score, abas de documentos independentes, presets Acadêmico (ABNT) e Normal e exportação do documento ativo em DOCX ou PDF.
