# auvo-sync/

## 🎯 Objetivo
Módulo principal que replica a lógica do workflow n8n para sincronização de leads. Responsável por: buscar dados na Auvo API, filtrar por consultores, verificar duplicidade, aplicar geocoding e preparar payloads para o Vtiger.

## 📂 Arquivos Principais
- `index.ts`: Reexporta types, helpers e services para uso externo
- `types/index.ts`: Todas as interfaces TypeScript + funções de configuração
- `helpers/dateHelper.ts`: Conversão de timestamps para formato Auvo
- `helpers/googleMapsHelper.ts`: Geocoding reverso via Google Maps API
- `services/auvoApiClient.ts`: Cliente HTTP para Auvo API
- `services/auvoSyncService.ts`: **Orquestrador principal** de toda a sincronização

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** `SyncInput { timestamp: string }` - timestamp ISO
- **Saída:** `SyncResult` com estatísticas + leads criados no Vtiger
- **Dependências externas:**
  - `luxon` - Manipulação de datas
  - `../../lib/prismaIntegration` - Verificação de duplicidade
  - `../../automation/createLead` - Criação do lead via Playwright

## ⚠️ Regras e Padrões
- **CRÍTICO:** Verificar duplicidade ANTES de processar (via `checkLeadExists`)
- Filtros configuráveis: `ENABLE_PILOT_FILTER`, `ENABLE_GEOCODING_FILTER`
- Geocoding é OPCIONAL - não quebrar se falhar, apenas logar warning
- Todas as interfaces devem estar em `types/index.ts`
- Constante `CONSULTOR_JOB_POSITION = 'Consultor'` para filtro
