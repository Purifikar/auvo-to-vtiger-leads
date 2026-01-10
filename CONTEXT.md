# Auvo to Vtiger Leads Integration

## 🎯 Objetivo
Automatização completa da migração de leads do sistema Auvo para o CRM Vtiger. Substitui um workflow n8n por uma solução Node.js/TypeScript standalone que busca clientes na Auvo, processa dados, aplica geocoding reverso e cria leads no Vtiger via automação Playwright.

## 📂 Estrutura Principal
- `src/` - Código fonte da aplicação
  - `admin/` - Admin Panel (HTML/CSS/JS) para gerenciamento de leads
  - `api/` - Servidor Express com endpoints REST
  - `automation/` - Scripts Playwright para automação
  - `auvo-sync/` - Módulo de sincronização com Auvo
  - `lib/` - Bibliotecas compartilhadas (logger, prisma, email, DLQ)
  - `scheduler/` - Cron jobs (sync + reprocessamento)
- `tests/` - Testes unitários e E2E
- `scripts/` - Scripts utilitários e migração SQL
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
    ↓
DLQ (23:00) → Reprocessa leads falhos automaticamente
```

## 🖥️ Admin Panel
Interface web acessível em `/admin` que permite:
- Visualizar estatísticas de leads (total, processados, em processamento, erros)
- Filtrar leads por status clicando nos cards
- Editar payload de leads com erro
- Reprocessar leads individuais ou em lote
- Gerenciar configurações do sistema
- Visualizar logs em tempo real

## ⚠️ Regras e Padrões
- **TypeScript Strict Mode** em todo o projeto
- **Dois bancos PostgreSQL:** `API` (LeadRequest, SystemConfig, ConfigHistory) e `integration` (entity_mapping)
- **Filtros configuráveis via .env:** PILOT_FILTER e GEOCODING_FILTER
- **Logs com Winston:** Todos os serviços usam `logger` de `src/lib/logger.ts`
- **Dependências críticas:** `playwright`, `luxon`, `node-cron`, `@prisma/client`
- **Deploy com Traefik:** Domínio `apicrm.purifikar.com.br` com SSL automático

## 🔧 Variáveis de Ambiente Críticas
| Variável | Descrição |
|----------|-----------|
| `AUVO_API_KEY/TOKEN` | Credenciais da Auvo API |
| `DATABASE_URL` | Banco principal (LeadRequest, SystemConfig) |
| `DATABASE_INTEGRATION_URL` | Banco de duplicidade (entity_mapping) |
| `API_BASE_URL` | URL pública da API (https://apicrm.purifikar.com.br) |
| `ENABLE_PILOT_FILTER` | Filtrar apenas consultores piloto |
| `SYNC_CRON_EXPRESSION` | Agendamento sync (padrão: */10 * * * *) |
| `REPROCESS_CRON_EXPRESSION` | Agendamento DLQ (padrão: 0 23 * * *) |

## 🐳 Deploy
```bash
# Iniciar com Traefik
docker-compose up -d

# Serviços:
# - api: Servidor Express + Admin Panel (apicrm.purifikar.com.br)
# - scheduler: Cron jobs de sincronização e reprocessamento
```
