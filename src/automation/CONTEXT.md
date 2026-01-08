# automation/

## 🎯 Objetivo
Automação Playwright para criar leads no Vtiger CRM. Abre browser, faz login, navega até formulário de lead, preenche campos e salva.

## 📂 Arquivos Principais
- `createLead.ts`: Função principal que orquestra toda a automação

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** `VtigerWebhookPayload` com dados do lead
- **Saída:** `recordId` (string) - ID do lead criado no Vtiger
- **Dependências:**
  - `playwright` (chromium)
  - `../pages/login.page` - Page Object para login
  - `../pages/lead.page` - Page Object para formulário de lead

## ⚠️ Regras e Padrões

### Fluxo de Execução:
1. Launch chromium (headless: false para debug)
2. Login no CRM (`CRM_USERNAME`, `CRM_PASSWORD`)
3. Navega para "Add Lead"
4. Mapeia dados do payload para campos do formulário
5. Preenche campos via Page Objects
6. Salva e aguarda redirecionamento
7. Extrai recordId da URL
8. Fecha browser

### Mapeamento de Campos:
| Payload | Campo Formulário |
|---------|------------------|
| vtiger.company | company |
| vtiger.lastname | lastname |
| vtiger.phone | mobile |
| vtiger.email | email |
| vtiger.cf_995 | street |
| others.Task.userFromName | Parsing para City Polo |

### Tratamento de Erro:
- Screenshot salvo em caso de falha
- Browser sempre fechado no finally
- Erro propagado para o AuvoSyncService tratar
