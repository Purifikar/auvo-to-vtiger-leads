# Auvo to Vtiger Leads Integration

## 🎯 Objetivo
Automatização completa da migração de leads do sistema Auvo para o CRM Vtiger. Substitui um workflow n8n por uma solução Node.js/TypeScript standalone que busca clientes na Auvo, processa dados, aplica geocoding reverso e cria leads no Vtiger via automação Playwright.

## 📂 Estrutura Principal
- `src/` - Código fonte da aplicação
- `tests/` - Testes unitários e E2E
- `scripts/` - Scripts utilitários
- `prisma/` - Schema do banco de dados

## 🔄 Fluxo de Dados Principal
```
Scheduler (Cron 10min)
    ↓
AuvoSyncService.sync()
    ↓
Auvo API → Busca Customers → Busca Tasks → Busca Users
    ↓
Valida (Consultor? Piloto? Duplicado?)
    ↓
Google Maps API → Geocoding Reverso
    ↓
Playwright → createLeadAutomation() → Vtiger CRM
    ↓
PostgreSQL → entity_mapping (duplicidade) + LeadRequest (log)
```

## ⚠️ Regras e Padrões
- **TypeScript Strict Mode** em todo o projeto
- **Dois bancos PostgreSQL:** `API` (LeadRequest) e `integration` (entity_mapping)
- **Filtros configuráveis via .env:** PILOT_FILTER e GEOCODING_FILTER
- **Logs com Winston:** Todos os serviços usam `logger` de `src/lib/logger.ts`
- **Dependências críticas:** `playwright`, `luxon`, `node-cron`, `@prisma/client`

## 🔧 Variáveis de Ambiente Críticas
| Variável | Descrição |
|----------|-----------|
| `AUVO_API_KEY/TOKEN` | Credenciais da Auvo API |
| `DATABASE_URL` | Banco principal (LeadRequest) |
| `DATABASE_INTEGRATION_URL` | Banco de duplicidade (entity_mapping) |
| `ENABLE_PILOT_FILTER` | Filtrar apenas consultores piloto |
| `SYNC_CRON_EXPRESSION` | Agendamento (padrão: */10 * * * *) |
