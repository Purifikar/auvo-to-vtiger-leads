# services/

## 🎯 Objetivo
Serviços de negócio que orquestram a sincronização. Contém o cliente HTTP para Auvo API e o serviço principal de sincronização.

## 📂 Arquivos Principais
- `index.ts`: Reexporta os serviços
- `auvoApiClient.ts`: Cliente HTTP para Auvo API com autenticação
- `auvoSyncService.ts`: **Serviço principal** - orquestra todo o fluxo de sincronização

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** `SyncInput { timestamp }` via método `sync()`
- **Saída:** `SyncResult` com estatísticas e resultados por lead
- **Dependências:**
  - `../../lib/prismaIntegration` - Verificação/registro de duplicidade
  - `../../lib/prisma` - Persistência de LeadRequest
  - `../../lib/email` - Notificação de erros
  - `../../automation/createLead` - Automação Playwright
  - `../helpers` - dateHelper e googleMapsHelper

## ⚠️ Regras e Padrões

### auvoApiClient.ts:
- Token é cacheado por 55 minutos (expira em 1h na Auvo)
- Métodos principais: `getCustomers()`, `getTasks()`, `getUsers()`
- Filtros são enviados como `ParamFilter` JSON encoded

### auvoSyncService.ts:
**Fluxo do método sync():**
1. Calcular dateRange via `parseDateRange()`
2. Buscar customers com `creationDate = dateEnd`
3. Para cada customer:
   - Verificar duplicidade (`checkLeadExists`)
   - Buscar tasks do período
   - Buscar user pelo `userFromName`
   - Validar `jobPosition === 'Consultor'`
   - Aplicar filtro piloto
   - Aplicar geocoding (se configurado)
   - Salvar LeadRequest (status: PROCESSING)
   - Chamar `createLeadAutomation()`
   - Registrar no entity_mapping (se sucesso)
   - Enviar email (se erro)

**Delay:** 1 segundo entre processamentos para não sobrecarregar
