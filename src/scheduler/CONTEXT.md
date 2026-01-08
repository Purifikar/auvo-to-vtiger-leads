# scheduler/

## 🎯 Objetivo
Agendador de sincronização usando node-cron. Executa a sincronização automaticamente a cada 10 minutos (configurável). Substitui o Schedule Trigger do n8n.

## 📂 Arquivos Principais
- `index.ts`: Configuração do cron job e funções de controle

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Nenhuma (execução automática via cron)
- **Saída:** Chamada a `AuvoSyncService.sync()` a cada intervalo
- **Dependências:**
  - `node-cron` - Agendamento
  - `../auvo-sync` - Serviço de sincronização
  - `../lib/logger` - Logging

## ⚠️ Regras e Padrões

### Configuração via .env:
- `SYNC_CRON_EXPRESSION` - Expressão cron (padrão: `*/10 * * * *`)
- `SYNC_RUN_IMMEDIATELY` - Se `true`, executa ao iniciar

### Funções Exportadas:
- `startScheduler()` - Inicia o cron job, retorna task
- `stopScheduler(task)` - Para o cron job
- `getSchedulerStats()` - Estatísticas (runs, successes, failures)
- `runManualSync()` - Execução manual fora do cron

### Controle de Concorrência:
- Flag `isRunning` evita execuções sobrepostas
- Se uma sync ainda está rodando, a próxima é pulada

### Execução Standalone:
```bash
npm run start:scheduler  # Produção
npm run dev:scheduler    # Desenvolvimento (nodemon)
```

### Graceful Shutdown:
- Escuta SIGINT e SIGTERM
- Para o scheduler antes de sair
