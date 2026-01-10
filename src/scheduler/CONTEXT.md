# scheduler/

## 🎯 Objetivo
Agendador de sincronização e reprocessamento usando node-cron. Executa:
1. Sincronização automática a cada 10 minutos (configurável)
2. Reprocessamento automático de leads falhos às 23:00 (configurável)

## 📂 Arquivos Principais
- `index.ts`: Configuração dos cron jobs e funções de controle

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Nenhuma (execução automática via cron)
- **Saída:** 
  - Sync: Chamada a `AuvoSyncService.sync()`
  - Reprocess: Chamada a `reprocessAllFailed()`
- **Dependências:**
  - `node-cron` - Agendamento
  - `../auvo-sync` - Serviço de sincronização
  - `../lib/dlqService` - Serviço de DLQ
  - `../lib/logger` - Logging

## ⚠️ Regras e Padrões

### Configuração via .env:
| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SYNC_CRON_EXPRESSION` | `*/10 * * * *` | Expressão cron para sync |
| `SYNC_RUN_IMMEDIATELY` | `false` | Se executa ao iniciar |
| `REPROCESS_CRON_EXPRESSION` | `0 23 * * *` | Expressão cron para reprocessamento |
| `MAX_RETRY_COUNT` | `3` | Máximo de tentativas por lead |

### Funções Exportadas:
- `startScheduler()` - Inicia os cron jobs, retorna { syncTask, reprocessTask }
- `stopScheduler(tasks)` - Para os cron jobs
- `getSchedulerStats()` - Estatísticas (runs, successes, failures, reprocessStats)
- `runManualSync()` - Execução manual de sync
- `runManualReprocess(maxRetries?)` - Execução manual de reprocessamento

### Jobs Agendados:
1. **Sync Job**: Busca clientes na Auvo e cria leads no Vtiger
2. **Reprocess Job**: Às 23:00, tenta reprocessar todos os leads FAILED com retryCount < MAX_RETRY_COUNT

### Controle de Concorrência:
- Flags `isRunning` e `isReprocessing` evitam execuções sobrepostas
- Cada job pode rodar independentemente

### Execução Standalone:
```bash
npm run start:scheduler  # Produção
npm run dev:scheduler    # Desenvolvimento (nodemon)
```

### Graceful Shutdown:
- Escuta SIGINT e SIGTERM
- Para ambos os schedulers antes de sair
