# scripts/

## 🎯 Objetivo
Scripts utilitários para execução manual e manutenção do projeto.

## 📂 Arquivos Principais
- `sync-now.ts`: Executa sincronização manual imediata

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Variáveis de ambiente (.env)
- **Saída:** Resultado da sincronização no console
- **Dependências:** `../src/scheduler`, `../src/lib/logger`

## ⚠️ Regras e Padrões

### Uso:
```bash
npm run sync-now
```

### Output:
- Estatísticas completas da sincronização
- Detalhes por lead (SUCCESS/SKIPPED/ERROR)
- Duração total

### Quando usar:
- Testes manuais
- Debugging
- Forçar sincronização fora do cron
