# lib/dlqService.ts

## 🎯 Objetivo
Serviço de Dead Letter Queue (DLQ) para gerenciar leads que falharam no processamento. Permite listar, editar, e reprocessar leads com erro.

## 📂 Funções Principais
- `getFailedLeads(filters?)`: Lista todos os leads com status FAILED
- `getLeadStats()`: Retorna estatísticas gerais (total, failed, processed, taxa de sucesso)
- `reprocessLead(id)`: Reprocessa um único lead
- `batchReprocessLeads(ids)`: Reprocessa múltiplos leads em lote
- `reprocessAllFailed(maxRetries)`: Reprocessa todos os leads falhos (usado pelo cron)
- `updateLeadPayload(id, newPayload)`: Edita o payload de um lead
- `getPayloadDiff(id)`: Retorna diff entre payload original e atual

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** IDs de leads ou filtros de busca
- **Saída:** Resultados de reprocessamento com estatísticas
- **Dependências:**
  - `./prisma` - Acesso ao banco de dados
  - `./logger` - Logging
  - `../automation/createLead` - Automação de criação no Vtiger
  - `./email` - Notificação de erro (opcional)

## ⚠️ Regras e Padrões

### Controle de Tentativas:
- Cada lead tem um `retryCount` que é incrementado a cada tentativa
- O reprocessamento automático respeita o `MAX_RETRY_COUNT` (padrão: 3)
- Leads que excedem o limite não são mais reprocessados automaticamente

### Edição de Payload:
- Quando o payload é editado, o `originalPayload` guarda a versão inicial
- Permite comparar (diff) entre o que foi recebido e o que foi corrigido

### Delay entre Processamentos:
- No batch retry há um delay de 500ms entre cada lead
- Evita sobrecarga no Vtiger/Playwright
