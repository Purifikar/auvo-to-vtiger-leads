# tests/

## 🎯 Objetivo
Testes automatizados do projeto usando Jest (unitários) e Playwright (E2E).

## 📂 Arquivos Principais
- `setup.ts`: Configuração global do Jest (carrega .env)
- `unit/` - Testes unitários

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Código fonte do projeto
- **Saída:** Relatório de testes (pass/fail)
- **Dependências:** `jest`, `ts-jest`, `@playwright/test`

## ⚠️ Regras e Padrões

### Estrutura:
```
tests/
├── setup.ts           # Setup global
└── unit/
    ├── dateHelper.test.ts    # Testes de conversão de datas
    ├── duplicity.test.ts     # Testes de duplicidade (CRÍTICO)
    ├── config.test.ts        # Testes de configuração
    └── cityPolo.test.ts      # Parser de userFromName
```

### Scripts npm:
- `npm run test` - Todos os testes Jest
- `npm run test:unit` - Apenas unitários
- `npm run test:e2e` - Playwright
- `npm run test:coverage` - Com cobertura

### Testes de Duplicidade:
- Validam que `checkLeadExists` funciona corretamente
- Testam cenário de leads iguais e diferentes
- **CRÍTICO para garantir que não duplica leads**
