# lib/

## 🎯 Objetivo
Bibliotecas compartilhadas usadas por todo o projeto: logging, conexões de banco de dados, notificações por email e Dead Letter Queue (DLQ).

## 📂 Arquivos Principais
- `logger.ts`: Configuração do Winston logger
- `prisma.ts`: Cliente Prisma para banco principal (API)
- `prismaIntegration.ts`: Cliente Prisma para banco de integração (entity_mapping)
- `email.ts`: Envio de emails de notificação de erro
- `dlqService.ts`: Serviço de Dead Letter Queue para reprocessamento de leads

## 🔄 Fluxo de Dados e Dependências
- **logger:** Usado por TODOS os módulos para logging consistente
- **prisma:** Persiste LeadRequest (status, payload, vtigerId, errorMessage)
- **prismaIntegration:** Verifica/registra duplicidade de leads
- **email:** Envia notificação quando automação falha
- **dlqService:** Gerencia reprocessamento de leads falhos

## ⚠️ Regras e Padrões

### logger.ts:
- Service name: `auvo-vtiger-service`
- Formato: `timestamp level message json`
- Arquivos: `error.log` (apenas erros) + `combined.log` (todos)
- **IMPORTANTE:** O endpoint `/api/logs` lê diretamente destes arquivos

### prisma.ts (Banco API):
- `DATABASE_URL` - Tabelas: `LeadRequest`, `SystemConfig`, `ConfigHistory`, `SystemLog`
- Campos LeadRequest: id, payload, status, vtigerId, errorMessage, retryCount, lastRetryAt, originalPayload, source, createdAt, updatedAt
- Campos SystemConfig: id, key, value, type, description, createdAt, updatedAt
- Campos ConfigHistory: id, configKey, oldValue, newValue, changedBy, changedAt

### prismaIntegration.ts (Banco integration):
- `DATABASE_INTEGRATION_URL` - Tabela: `entity_mapping`
- **CRÍTICO:** Usado para evitar duplicidade
- Funções:
  - `checkLeadExists(auvoId)` - Retorna boolean
  - `recordLeadMapping(auvoId, crmId)` - Registra após sucesso
  - `getLeadMapping(auvoId)` - Busca registro completo

### email.ts:
- Usa nodemailer com configuração SMTP
- Template HTML rico com informações do erro
- Inclui comando curl para retry

### dlqService.ts:
- Funções principais:
  - `getFailedLeads(filters?)` - Lista leads com erro
  - `getLeadStats()` - Retorna estatísticas
  - `reprocessLead(id)` - Reprocessa um lead
  - `batchReprocessLeads(ids)` - Reprocessa em lote
  - `reprocessAllFailed(maxRetries)` - Job automático
  - `updateLeadPayload(id, payload)` - Edita payload
  - `getPayloadDiff(id)` - Compara original vs atual
- Fluxo de reprocessamento:
  1. Marca lead como PROCESSING
  2. Executa createLeadAutomation
  3. On success: marca PROCESSED + limpa errorMessage
  4. On error: marca FAILED + incrementa retryCount
