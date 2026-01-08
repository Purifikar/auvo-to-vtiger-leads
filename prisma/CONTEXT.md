# prisma/

## 🎯 Objetivo
Schema do Prisma ORM para o banco de dados principal (API). Define o modelo LeadRequest para rastrear processamento de leads.

## 📂 Arquivos Principais
- `schema.prisma`: Definição do schema do banco

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Configuração via `DATABASE_URL`
- **Saída:** Cliente Prisma gerado em `node_modules/.prisma/client`
- **Dependências:** `prisma`, `@prisma/client`

## ⚠️ Regras e Padrões

### Modelo LeadRequest:
```prisma
model LeadRequest {
  id           Int      @id @default(autoincrement())
  payload      String   // JSON stringified do VtigerWebhookPayload
  status       String   // PROCESSING | PROCESSED | FAILED
  vtigerId     String?  // ID do lead no Vtiger (se sucesso)
  errorMessage String?  // Mensagem de erro (se falha)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Comandos:
- `npx prisma generate` - Gera cliente (roda no postinstall)
- `npx prisma db push` - Aplica schema no banco
- `npx prisma studio` - UI para visualizar dados

### NOTA:
O banco `integration` (entity_mapping) usa raw queries em `prismaIntegration.ts`, não tem schema Prisma próprio pois é compartilhado com outros sistemas.
