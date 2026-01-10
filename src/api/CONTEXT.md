# api/

## 🎯 Objetivo
Servidor Express que expõe endpoints para receber webhooks de leads, gerenciar a Dead Letter Queue (DLQ), servir o Admin Panel e permitir reprocessamento de leads falhos. Funciona independentemente do scheduler.

## 📂 Arquivos Principais
- `server.ts`: Configuração do Express e definição de rotas

## 🔄 Fluxo de Dados e Dependências
- **Entrada:** Requisições HTTP
- **Saída:** Resposta JSON com status, vtigerId, estatísticas
- **Dependências:**
  - `express` - Framework web
  - `../automation/createLead` - Automação Playwright
  - `../lib/prisma` - Persistência
  - `../lib/email` - Notificação de erro
  - `../lib/dlqService` - Serviço de DLQ
  - `../admin/` - Static files do Admin Panel

## ⚠️ Regras e Padrões

### Admin Panel:
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin` | Interface web do Admin Panel |

### Endpoints Health & Stats:
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Estatísticas gerais de leads |

### Endpoints Webhook:
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/webhook/lead` | Recebe lead p/ processamento |
| POST | `/webhook/lead/:id/retry` | Reprocessa lead falho (legacy) |

### Endpoints DLQ (Dead Letter Queue):
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/leads/all` | Lista todos os leads (para Admin) |
| GET | `/api/leads/failed` | Lista todos os leads com erro |
| POST | `/api/leads/fix-stuck` | Corrige leads presos em PROCESSING |
| GET | `/api/lead/:id` | Busca lead específico por ID |
| POST | `/api/lead/:id/reprocess` | Reprocessa lead individual |
| PUT | `/api/lead/:id/payload` | Edita payload de um lead |
| GET | `/api/lead/:id/diff` | Retorna diff do payload |
| POST | `/api/leads/batch-retry` | Reprocessa múltiplos leads |

### Endpoints Config:
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/configs` | Lista configurações do sistema |
| PUT | `/api/configs` | Atualiza configurações |
| GET | `/api/configs/history` | Histórico de alterações |

### Endpoints Logs:
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/logs` | Lista logs do sistema (lê do Winston) |

### Fluxo POST /webhook/lead:
1. Valida payload
2. Salva LeadRequest (PROCESSING, source: WEBHOOK)
3. Executa `createLeadAutomation()`
4. Atualiza status (PROCESSED ou FAILED)
5. Retorna vtigerId ou erro

### Fluxo POST /api/leads/batch-retry:
1. Recebe array de IDs `{ ids: [1, 2, 3] }`
2. Limite máximo: 50 leads por requisição
3. Processa sequencialmente com delay de 500ms
4. Retorna estatísticas detalhadas

### Fluxo POST /api/leads/fix-stuck:
1. Busca leads em PROCESSING há mais de 10 minutos
2. Marca como FAILED com mensagem explicativa
3. Retorna quantidade corrigida

### Porta:
- `process.env.PORT` ou 3000

### Deploy (Traefik):
- Domínio: `apicrm.purifikar.com.br`
- SSL: Let's Encrypt via certresolver
