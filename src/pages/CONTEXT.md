# pages/

## 🎯 Objetivo
Page Objects para automação Playwright. Encapsulam seletores e ações do Vtiger CRM, facilitando manutenção quando a UI mudar.

## 📂 Arquivos Principais
- `login.page.ts`: Page Object para tela de login do Vtiger
- `lead.page.ts`: Page Object para formulário de criação de lead

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Instância de `Page` do Playwright
- **Saída:** Ações executadas no browser (clicks, fills, selects)
- **Dependências:** `playwright`

## ⚠️ Regras e Padrões

### login.page.ts:
- `goto()` - Navega para CRM_URL
- `login(username, password)` - Preenche e submete formulário

### lead.page.ts:
- `navigateToAddLead()` - Menu → Leads → Add Lead
- `fillLeadForm(data)` - Preenche todos os campos do formulário
- `saveLead()` - Clica em Save e aguarda confirmação
- `selectCity(city)` - Regex para selecionar cidade (com ou sem UF)

### Seletores importantes:
- Use seletores robustos (data-testid, aria-label, texto visível)
- Evite seletores por classe CSS que podem mudar
- Picklists usam busca por texto visível da opção

### Padrão de timeout:
- Aumentar timeout para operações lentas do CRM
- `waitForURL` com regex para aguardar navegação
