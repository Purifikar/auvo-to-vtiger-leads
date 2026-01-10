# Admin Panel - CONTEXT.md

## Propósito
Interface web para gerenciamento completo do sistema de sincronização de leads Auvo → Vtiger.

## Arquivos

### `index.html`
- Estrutura HTML do painel administrativo
- Cards de estatísticas clicáveis (Total, Processados, Em Processamento, Com Erro)
- Tabs: Leads, Configurações, Logs
- Modais: Edição de Payload, Visualização de Detalhes
- Filtros: Período, Origem
- Toast notifications para feedback

### `styles.css`
- Paleta de cores dark mode baseada no prodpanel.purifikar.com.br
- Cores principais:
  - Background: `#0a0f1a`, `#111827`
  - Accent Blue: `#3b82f6`
  - Accent Green: `#10b981`
  - Accent Orange: `#f59e0b`
  - Accent Red: `#ef4444`
- Componentes: cards, tabelas, modais, badges de status, toggles
- Animações: spinners, toasts, hover effects

### `app.js`
- Gerenciamento de estado (leads, filtros, seleção)
- Integração com API endpoints
- Funções principais:
  - `loadStats()`: Carrega estatísticas
  - `loadAllLeads()`: Carrega lista de leads
  - `filterByStatus()`: Filtra por cards clicáveis
  - `reprocessSingle()` / `batchRetrySelected()`: Reprocessamento
  - `openEditModal()` / `openViewModal()`: Modais
  - `loadConfigs()` / `saveConfigs()`: Configurações
  - `loadLogs()`: Logs em tempo real
  - `showToast()`: Notificações

## Fluxo de Dados

```
Usuário clica em card → filterByStatus() → applyStatusFilter() → renderLeadsTable()
                                        ↓
Usuário edita payload → saveAndReprocess() → API PUT /payload → API POST /reprocess
                                           ↓
                                     Toast + Reload
```

## Dependências Externas
- Lucide Icons (CDN)
- Google Fonts (Inter)

## Servido por
`src/api/server.ts` via `express.static('/admin')`

## URL de Acesso
- Local: `http://localhost:3000/admin`
- Produção: `https://apicrm.purifikar.com.br/admin`
