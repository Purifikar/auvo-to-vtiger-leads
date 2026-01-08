# api/

## 🎯 Objetivo
Servidor Express que expõe endpoints para receber webhooks de leads e permitir retry de leads falhos. Funciona independentemente do scheduler.

## 📂 Arquivos Principais
- `server.ts`: Configuração do Express e definição de rotas

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Requisições HTTP (POST /webhook/lead, POST /webhook/lead/:id/retry)
- **Saída:** Resposta JSON com status e vtigerId
- **Dependências:**
  - `express` - Framework web
  - `../automation/createLead` - Automação Playwright
  - `../lib/prisma` - Persistência
  - `../lib/email` - Notificação de erro

## ⚠️ Regras e Padrões

### Endpoints:
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| POST | `/webhook/lead` | Recebe lead p/ processamento |
| POST | `/webhook/lead/:id/retry` | Reprocessa lead falho |

### Fluxo POST /webhook/lead:
1. Valida payload
2. Salva LeadRequest (PROCESSING)
3. Executa `createLeadAutomation()`
4. Atualiza status (PROCESSED ou FAILED)
5. Retorna vtigerId ou erro

### Fluxo POST /webhook/lead/:id/retry:
1. Busca LeadRequest pelo ID
2. Valida que existe e está FAILED
3. Reprocessa via `createLeadAutomation()`
4. Atualiza status

### Porta:
- `process.env.PORT` ou 3000
