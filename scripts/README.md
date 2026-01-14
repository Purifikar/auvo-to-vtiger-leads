# 📜 Scripts de Utilidade

Esta pasta contém scripts de utilidade para gerenciamento e diagnóstico da integração Auvo → Vtiger.

## 🚀 Como Executar

Todos os scripts são executados com `npx ts-node`:

```bash
npx ts-node scripts/<nome-do-script>.ts [argumentos]
```

---

## 📋 Lista de Scripts

### 🔍 Diagnóstico e Visualização

#### `view-lead.ts`
Visualiza detalhes de um lead específico, incluindo payload e campos do Vtiger.

```bash
npx ts-node scripts/view-lead.ts <leadId>

# Exemplo:
npx ts-node scripts/view-lead.ts 28
```

**Saída:**
- Status do lead
- AuvoId
- Endereço da Auvo
- Todos os campos vtiger (logradouro, bairro, cidade, etc.)

---

#### `check-integration-data.ts`
Verifica dados no banco de integração (entity_mapping).

```bash
npx ts-node scripts/check-integration-data.ts
```

**Saída:**
- Total de leads no entity_mapping
- Últimos 10 registros com auvo_id e crm_id

---

### 🔧 Correção e Manutenção

#### `fix-lead-payload.ts`
Corrige campos com valor "undefined" no payload de um lead e aplica fallbacks.

```bash
npx ts-node scripts/fix-lead-payload.ts <leadId>

# Exemplo:
npx ts-node scripts/fix-lead-payload.ts 28
```

**O que faz:**
- Remove valores "undefined" dos campos
- Define bairro usando cidade como fallback (se vazio)
- Reseta o status para PENDING
- Remove a reserva do entity_mapping

---

#### `cleanup-duplicates.ts`
Limpa registros duplicados nas tabelas LeadRequest e entity_mapping.

```bash
npx ts-node scripts/cleanup-duplicates.ts
```

**O que faz:**
- Identifica grupos de duplicatas por auvoId
- Mantém o registro mais antigo ou com status PROCESSED
- Remove os registros duplicados

---

#### `migrate-auvo-ids.ts`
Popula o campo `auvoId` em registros LeadRequest antigos (extrai do payload JSON).

```bash
npx ts-node scripts/migrate-auvo-ids.ts
```

**Quando usar:** Após migração do banco que adicionou o campo `auvoId`.

---

### 🔄 Reprocessamento

#### `reprocess-lead.ts`
Prepara um lead para reprocessamento do zero.

```bash
npx ts-node scripts/reprocess-lead.ts <leadId>

# Exemplo:
npx ts-node scripts/reprocess-lead.ts 28
```

**O que faz:**
- Mostra detalhes do lead
- Remove a reserva do entity_mapping
- Reseta o status para PENDING
- **Não executa o reprocessamento** - apenas prepara

Para reprocessar após rodar o script:
```bash
# Via curl
curl -X POST http://localhost:3000/api/lead/28/reprocess

# Via PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/lead/28/reprocess" -Method POST
```

---

### 📡 Sincronização

#### `sync-now.ts`
Executa uma sincronização manual imediata com a Auvo.

```bash
npx ts-node scripts/sync-now.ts
# ou
npm run sync-now
```

---

#### `sync-retroactive.ts`
Executa sincronização retroativa para um período específico.

```bash
npx ts-node scripts/sync-retroactive.ts [dias]

# Exemplo: Sincronizar últimos 7 dias
npx ts-node scripts/sync-retroactive.ts 7
```

---

### 🧪 Testes

#### `test-email.ts`
Testa o envio de email de erro.

```bash
npx ts-node scripts/test-email.ts
```

---

#### `test-webhook.ts`
Testa o webhook de criação de lead.

```bash
npx ts-node scripts/test-webhook.ts
```

---

#### `debug-form.ts`
Debug do formulário de lead no Playwright.

```bash
# Com navegador visível
$env:PLAYWRIGHT_HEADLESS="false"; npx ts-node scripts/debug-form.ts
```

---

#### `interactive-debug.ts`
Debug interativo do Playwright.

```bash
$env:PLAYWRIGHT_HEADLESS="false"; npx ts-node scripts/interactive-debug.ts
```

---

#### `capture-labels.ts`
Captura labels dos campos do formulário de lead no CRM.

```bash
$env:PLAYWRIGHT_HEADLESS="false"; npx ts-node scripts/capture-labels.ts
```

---

## 💡 Dicas

### Rodar com navegador visível (debug)
```bash
# PowerShell
$env:PLAYWRIGHT_HEADLESS="false"; npx ts-node scripts/<script>.ts

# Bash
PLAYWRIGHT_HEADLESS=false npx ts-node scripts/<script>.ts
```

### Filtrar output do Prisma (remover logs de query)
```bash
npx ts-node scripts/view-lead.ts 28 2>&1 | Select-String -Pattern "^[^p]"
```

---

## 📂 Estrutura

```
scripts/
├── README.md              # Este arquivo
├── view-lead.ts           # Visualizar lead
├── fix-lead-payload.ts    # Corrigir payload
├── reprocess-lead.ts      # Preparar reprocessamento
├── cleanup-duplicates.ts  # Limpar duplicatas
├── migrate-auvo-ids.ts    # Migrar auvoIds
├── sync-now.ts            # Sincronização manual
├── sync-retroactive.ts    # Sincronização retroativa
├── check-integration-data.ts  # Verificar entity_mapping
├── test-email.ts          # Testar email
├── test-webhook.ts        # Testar webhook
├── debug-form.ts          # Debug form
├── interactive-debug.ts   # Debug interativo
└── capture-labels.ts      # Capturar labels
```
