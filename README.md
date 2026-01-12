# Auvo to Vtiger Leads Integration

Integração automática de Leads do sistema **Auvo** para o CRM **Vtiger** usando automação via **Playwright**.

> **v2.3.0** - Correção de duplicidade de leads com campo `auvoId` dedicado + Admin Panel completo.

## 🚀 Funcionalidades

### Admin Panel (Novo v2.2) 🎉
- **Dashboard Completo**: Estatísticas em tempo real (total, processados, em processamento, erros)
- **Cards Clicáveis**: Filtre leads por status com um clique
- **Visualização de Leads**: Tabela com todos os leads ordenados por última atualização
- **Cores por Status**: Verde (sucesso), Laranja (processando), Vermelho (erro)
- **Edição de Payload**: Corrija dados de leads com erro antes de reprocessar
- **Reprocessamento em Lote**: Selecione múltiplos leads e reprocesse de uma vez
- **Configurações do Sistema**: Feature toggles e parâmetros editáveis pela interface
- **Logs em Tempo Real**: Visualize os logs do sistema com filtros por nível e busca
- **Fix de Leads Presos**: Endpoint para recuperar leads travados em PROCESSING

### Modo Scheduler
- **Sincronização Automática**: Cron job busca leads na Auvo a cada 10 minutos
- **Verificação de Duplicidade**: Não processa leads já existentes
- **Filtro de Consultores**: Processa apenas usuários com `jobPosition = 'Consultor'`
- **Filtro Piloto**: Permite testar com usuários específicos antes de produção
- **Geocoding Reverso**: Converte coordenadas em endereço via Google Maps API
- **Reprocessamento Automático**: Às 23:00 tenta reprocessar todos os leads falhos

### Modo API (Webhook)
- **Webhook Síncrono**: Recebe dados externos, processa e retorna o ID do lead criado
- **Endpoint de Retry**: Reprocessa leads que falharam via `POST /webhook/lead/:id/retry`
- **Notificação de Erro**: Envia e-mail com link para reprocessar em caso de falha

### Dead Letter Queue (DLQ)
- **Fila de Erros**: Todos os leads que falharam são armazenados para reprocessamento
- **Reprocessamento Automático**: Job às 23:00 tenta processar leads falhos (máx. 3 tentativas)
- **Reprocessamento Manual**: Endpoints para reprocessar individual ou em lote
- **Edição de Payload**: Corrige dados antes de reprocessar (telefone, email, etc.)
- **Diff de Payload**: Compara versão original com a corrigida
- **Estatísticas**: Endpoint mostra total, sucesso, falhas e taxa de sucesso

### Automação
- **Playwright**: Preenche o formulário no Vtiger automaticamente
- **Page Objects**: Estrutura organizada para fácil manutenção
- **Lógica de Cidade Polo**: Extrai "Cidade Polo" e "Responsável" do `userFromName`

## 🛠️ Tecnologias

- **Node.js** & **TypeScript** (Strict Mode)
- **Playwright** (Automação E2E)
- **Express** (API/Webhook/Admin Panel)
- **node-cron** (Scheduler)
- **Luxon** (Manipulação de datas)
- **PostgreSQL** + **Prisma** (ORM)
- **Traefik** (Reverse Proxy com SSL)
- **Jest** (Testes unitários)

## 📂 Estrutura do Projeto

```
src/
├── admin/           # Admin Panel (HTML/CSS/JS)
│   ├── index.html   # Interface principal
│   ├── styles.css   # Estilos (dark mode, Purifikar theme)
│   └── app.js       # Lógica JavaScript
├── api/             # Servidor Express (Webhook/Admin/DLQ)
├── automation/      # Scripts do Playwright
├── auvo-sync/       # Módulo principal de sincronização
│   ├── helpers/     # dateHelper, googleMapsHelper
│   ├── services/    # auvoApiClient, auvoSyncService
│   └── types/       # Interfaces TypeScript
├── lib/             # Utilitários (Logger, Email, Prisma, DLQ)
├── pages/           # Page Objects (LeadPage, LoginPage)
└── scheduler/       # Cron job (10 minutos + DLQ às 23h)

tests/
└── unit/            # Testes unitários (Jest)

scripts/
├── sync-now.ts      # Sincronização manual
└── migration_add_dlq.sql # Script SQL para migração DLQ
```

## ⚙️ Configuração

### 1. Instale as dependências
```bash
npm install
```

### 2. Configure as Variáveis de Ambiente (`.env`)

```env
# CRM Configuration
CRM_URL=https://crm.purifikar.com.br/
CRM_USERNAME=seu_usuario
CRM_PASSWORD=sua_senha

# API Configuration
API_BASE_URL=https://apicrm.purifikar.com.br

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/API?schema=public
DATABASE_INTEGRATION_URL=postgresql://user:password@host:5432/integration?schema=public

# Auvo API Configuration
AUVO_API_KEY=your_auvo_api_key
AUVO_API_TOKEN=your_auvo_api_token
AUVO_API_URL=https://api.auvo.com.br/v2

# Google Maps Configuration
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Email (Notificações de erro)
ERROR_EMAIL_TO=admin@purifikar.com.br
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=465
SMTP_USER=email@exemplo.com
SMTP_PASS=senha_email
SMTP_SECURE=true

# Pilot Filter (Desenvolvimento/Teste)
ENABLE_PILOT_FILTER=true          # 'false' para produção
PILOT_USER_IDS=213670             # IDs separados por vírgula

# Geocoding Filter
ENABLE_GEOCODING_FILTER=true
GEOCODING_USER_IDS=213670

# Scheduler Configuration
SYNC_CRON_EXPRESSION=*/10 * * * * # A cada 10 minutos
SYNC_RUN_IMMEDIATELY=false        # 'true' para rodar ao iniciar

# DLQ Configuration
DLQ_ENABLED=true
DLQ_CRON_EXPRESSION=0 23 * * *    # Às 23:00
DLQ_MAX_RETRIES=3
```

### 3. Configure o Banco de Dados
```bash
npx prisma db push
```

## 🚀 Como Rodar

### Modo Scheduler (Sincronização Automática)
```bash
# Desenvolvimento
npm run dev:scheduler

# Produção
npm run build
npm run start:scheduler
```

### Modo API (Webhook + Admin Panel)
```bash
# Desenvolvimento
npm run dev

# Produção
npm run start
```

### Acessar Admin Panel
```
http://localhost:3000/admin
# ou em produção:
https://apicrm.purifikar.com.br/admin
```

### Sincronização Manual
```bash
npm run sync-now
```

### Testes
```bash
npm run test          # Todos os testes
npm run test:unit     # Apenas unitários
npm run test:coverage # Com cobertura
```

## 🐳 Docker

### Build e Start (com Traefik)

O projeto está configurado para usar Traefik como reverse proxy no domínio `subdominio.dominio.com.br`.

```bash
# Iniciar API (com Admin Panel)
docker-compose up -d api

# Iniciar Scheduler
docker-compose up -d scheduler

# Iniciar ambos
docker-compose up -d

# Ver logs
docker-compose logs -f api
docker-compose logs -f scheduler
```

### Parar
```bash
docker-compose down
```

> **Nota:** O container usa a imagem oficial do Playwright (`mcr.microsoft.com/playwright:v1.55.1-jammy`) que já inclui os browsers necessários.

### Configuração Traefik

O `docker-compose.yml` já está configurado com as labels do Traefik:
- Domínio: `subdominio.dominio.com.br`
- SSL automático via Let's Encrypt
- Porta interna: 3000

## 🔄 Fluxo da Sincronização

```mermaid
flowchart TB
    A[⏰ Scheduler cada 10min] --> B[📡 Auvo API]
    B --> C{Clientes novos?}
    C -->|Sim| D[🔍 Busca Tarefas]
    D --> E[👤 Busca Usuário]
    E --> F{É Consultor?}
    F -->|Sim| G{Filtro Piloto?}
    G -->|Passa| H{Já existe?}
    H -->|Não| I[📍 Geocoding]
    I --> J[🎭 Playwright]
    J --> K[📊 Vtiger CRM]
    K --> L[(🗄️ PostgreSQL)]
    
    C -->|Não| M[✅ Fim]
    F -->|Não| M
    G -->|Não passa| M
    H -->|Sim| M
```

## 📡 Endpoints

### Health & Status

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Estatísticas gerais de leads |

### Admin Panel

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin` | Interface do Admin Panel |
| GET | `/api/leads/all` | Lista todos os leads |
| POST | `/api/leads/fix-stuck` | Corrige leads presos em PROCESSING |
| GET | `/api/configs` | Lista configurações |
| PUT | `/api/configs` | Atualiza configurações |
| GET | `/api/configs/history` | Histórico de alterações |
| GET | `/api/logs` | Lista logs do sistema |

### Webhook (Criação)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/webhook/lead` | Recebe e processa novo lead |
| POST | `/webhook/lead/:id/retry` | Reprocessa lead falho |

### DLQ (Dead Letter Queue)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/leads/failed` | Lista leads com erro |
| GET | `/api/lead/:id` | Busca lead por ID |
| POST | `/api/lead/:id/reprocess` | Reprocessa lead individual |
| PUT | `/api/lead/:id/payload` | Edita payload do lead |
| GET | `/api/lead/:id/diff` | Compara payload original vs atual |
| POST | `/api/leads/batch-retry` | Reprocessa múltiplos leads |

## 🧪 Testes

| Arquivo | Descrição |
|---------|-----------|
| `dateHelper.test.ts` | Conversão de timestamps |
| `duplicity.test.ts` | Verificação de duplicidade |
| `config.test.ts` | Parsing de configurações |
| `cityPolo.test.ts` | Parser de userFromName |

```bash
# Rodar todos os testes
npm run test

# Resultado esperado: 34 passed
```

## 📄 Licença

ISC
