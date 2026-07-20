# CLAUDE_RULES.md — Regras Permanentes de Trabalho

Este documento centraliza as regras de trabalho do projeto MathMaster para qualquer sessão do Claude (ou de outro agente) que implemente sprints, correções ou hardenings no repositório. Ele substitui a necessidade de repetir instruções a cada sprint: **este arquivo é a estrutura obrigatória de trabalho.**

Documentação relacionada: [README.md](./README.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [PRD.md](./PRD.md) · [UI_UX.md](./UI_UX.md) · [MVP_SCOPE.md](./MVP_SCOPE.md) · [LEARNING_RULES.md](./LEARNING_RULES.md)

---

## 1. Antes de implementar qualquer sprint

Antes de escrever qualquer código, o agente deve:

1. **Ler o escopo** da sprint (PRD, MVP_SCOPE, roadmap ou instrução direta do usuário) por completo antes de agir.
2. **Apresentar um plano curto** — passos objetivos, sem excesso de detalhe, cobrindo o que será feito e em que ordem.
3. **Listar os arquivos que serão alterados** (criados, modificados ou removidos), com caminho completo.
4. **Apontar riscos possíveis** — quebra de compatibilidade, impacto em UX, efeitos colaterais em outros módulos, dívida técnica introduzida.
5. **Pedir confirmação apenas para mudanças grandes** — mudanças estruturais, alterações de contrato de API, mudanças que afetem múltiplos módulos ou o comportamento visível ao usuário final. Ajustes pequenos e estritamente dentro do escopo já combinado não exigem nova confirmação a cada passo.

## 2. Durante a implementação

1. **Não sair do escopo.** Se algo fora do escopo for necessário, parar e reportar — não expandir a sprint silenciosamente.
2. **Preservar compatibilidade** com o código existente (contratos de API, formatos de resposta, comportamento já validado).
3. **Evitar duplicação de lógica** — reutilizar o que já existe em `math_engine/`, `formatter/` e nos componentes de frontend em vez de recriar.
4. **Manter UX, responsividade e renderização matemática funcionando** em todas as telas afetadas (KaTeX, teclado matemático, grid mobile, etc.).
5. **Não alterar endpoints sem necessidade** — mudanças de contrato HTTP só ocorrem quando forem o objetivo explícito da sprint.

## 3. Validação obrigatória

Antes de considerar qualquer sprint concluída, executar:

- [ ] Testes (`pytest` no backend, `npm run test` no frontend)
- [ ] Lint
- [ ] Build
- [ ] Smoke tests
- [ ] Validação desktop
- [ ] Validação mobile

Nenhuma sprint é considerada pronta sem esses seis itens verificados.

## 4. Relatório obrigatório ao final

Todo fechamento de sprint deve incluir um relatório com:

1. Resumo do que foi implementado
2. Arquivos modificados
3. Decisões arquiteturais tomadas
4. Resultado dos testes
5. Resultado do lint
6. Resultado do build
7. Resultado dos smoke tests
8. Limitações conhecidas

## 5. Regras de Git

- **Nunca fazer commit** sem autorização explícita do usuário para aquele commit específico.
- **Nunca fazer push.**
- **Nunca trocar de branch.**
- **Nunca executar ações destrutivas** (`reset --hard`, `checkout --`, `clean -f`, `rm` de arquivos versionados, force-push, etc.) sem autorização explícita e passo a passo — aprovação de um plano não é aprovação da mecânica destrutiva em si.

---

## Como expandir este documento

- Novas regras permanentes devem ser adicionadas na seção correspondente (ou em uma nova seção numerada, ao final).
- Regras específicas de uma única sprint **não** entram aqui — pertencem ao respectivo `docs/SESSION_LOG_*.md`.
- Se uma regra daqui for revista ou revogada, registrar a mudança e o motivo, não apenas apagar silenciosamente.
