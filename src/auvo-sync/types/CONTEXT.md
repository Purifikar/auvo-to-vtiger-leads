# types/

## 🎯 Objetivo
Centraliza todas as interfaces TypeScript e funções de configuração do módulo auvo-sync. Garante tipagem forte em todo o projeto.

## 📂 Arquivos Principais
- `index.ts`: Único arquivo, contém TODAS as interfaces e helpers de configuração

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Variáveis de ambiente (`process.env`)
- **Saída:** Interfaces tipadas e configurações validadas
- **Dependências:** Nenhuma externa (apenas Node.js built-in)

## ⚠️ Regras e Padrões

### Interfaces Principais:
| Interface | Uso |
|-----------|-----|
| `SyncInput` | Input do scheduler (timestamp) |
| `DateRange` | {dateStart, dateEnd} no formato Auvo |
| `AuvoCustomer` | Lead da Auvo |
| `AuvoTask` | Tarefa associada ao lead |
| `AuvoUser` | Usuário/Consultor da Auvo |
| `VtigerLeadData` | Dados formatados para o Vtiger |
| `VtigerWebhookPayload` | Payload completo {vtiger, others} |
| `SyncServiceConfig` | Configuração completa do serviço |

### Funções de Configuração:
- `getPilotFilterConfig()` - Parseia ENABLE_PILOT_FILTER e PILOT_USER_IDS
- `getGeocodingFilterConfig()` - Parseia filtros de geocoding
- `getAuvoConfig()` - Retorna credenciais Auvo (lança erro se faltar)
- `getSyncServiceConfig()` - Retorna configuração completa
- `isUserAllowed()` - Verifica se usuário passa no filtro piloto
- `shouldApplyGeocoding()` - Verifica se deve aplicar geocoding

### Constantes:
- `CONSULTOR_JOB_POSITION = 'Consultor'`
