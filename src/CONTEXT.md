# src/

## 🎯 Objetivo
Diretório principal contendo todo o código fonte da aplicação. Organizado em módulos por responsabilidade.

## 📂 Arquivos Principais
- `api/` - Servidor Express para webhooks e retries
- `auvo-sync/` - **Módulo principal** de sincronização Auvo → Vtiger
- `automation/` - Automação Playwright para criar leads no Vtiger
- `lib/` - Bibliotecas compartilhadas (logger, prisma, email)
- `pages/` - Page Objects para Playwright
- `scheduler/` - Cron job para execução automática

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Timestamp ISO do scheduler ou chamada manual
- **Saída:** Leads criados no Vtiger CRM + registros no PostgreSQL
- **Dependências:** `express`, `playwright`, `node-cron`, `luxon`, `@prisma/client`

## ⚠️ Regras e Padrões
- Imports entre módulos devem usar os arquivos `index.ts` de cada pasta
- Configurações vêm de `src/auvo-sync/types/index.ts` via funções `getXxxConfig()`
- Todo log deve usar `import { logger } from '../lib/logger'`
