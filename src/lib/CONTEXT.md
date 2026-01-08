# lib/

## 🎯 Objetivo
Bibliotecas compartilhadas usadas por todo o projeto: logging, conexões de banco de dados e notificações por email.

## 📂 Arquivos Principais
- `logger.ts`: Configuração do Winston logger
- `prisma.ts`: Cliente Prisma para banco principal (API)
- `prismaIntegration.ts`: Cliente Prisma para banco de integração (entity_mapping)
- `email.ts`: Envio de emails de notificação de erro

## 🔄 Fluxo de Dados e Dependências
- **logger:** Usado por TODOS os módulos para logging consistente
- **prisma:** Persiste LeadRequest (status, payload, vtigerId, errorMessage)
- **prismaIntegration:** Verifica/registra duplicidade de leads
- **email:** Envia notificação quando automação falha

## ⚠️ Regras e Padrões

### logger.ts:
- Service name: `auvo-vtiger-service`
- Formato: `timestamp level message json`
- Arquivos: `error.log` (apenas erros) + `combined.log` (todos)

### prisma.ts (Banco API):
- `DATABASE_URL` - Tabela: `LeadRequest`
- Campos: id, payload, status, vtigerId, errorMessage, createdAt, updatedAt

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
