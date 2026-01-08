# Auvo to Vtiger Leads Integration

Integração automática de Leads do sistema **Auvo** para o CRM **Vtiger** usando automação via **Playwright**.

> **v2.0.0** - Migração completa do workflow n8n para Node.js/TypeScript standalone com scheduler integrado.

## 🚀 Funcionalidades

### Modo Scheduler (Novo)
- **Sincronização Automática**: Cron job busca leads na Auvo a cada 10 minutos
- **Verificação de Duplicidade**: Não processa leads já existentes
- **Filtro de Consultores**: Processa apenas usuários com `jobPosition = 'Consultor'`
- **Filtro Piloto**: Permite testar com usuários específicos antes de produção
- **Geocoding Reverso**: Converte coordenadas em endereço via Google Maps API

### Modo API (Webhook)
- **Webhook Síncrono**: Recebe dados externos, processa e retorna o ID do lead criado
- **Endpoint de Retry**: Reprocessa leads que falharam via `POST /webhook/lead/:id/retry`
- **Notificação de Erro**: Envia e-mail com link para reprocessar em caso de falha

### Automação
- **Playwright**: Preenche o formulário no Vtiger automaticamente
- **Page Objects**: Estrutura organizada para fácil manutenção
- **Lógica de Cidade Polo**: Extrai "Cidade Polo" e "Responsável" do `userFromName`

## 🛠️ Tecnologias

- **Node.js** & **TypeScript** (Strict Mode)
- **Playwright** (Automação E2E)
- **Express** (API/Webhook)
- **node-cron** (Scheduler)
- **Luxon** (Manipulação de datas)
- **PostgreSQL** + **Prisma** (ORM)
- **Jest** (Testes unitários)

## 📂 Estrutura do Projeto

```
src/
├── api/             # Servidor Express (Webhook/Retry)
├── automation/      # Scripts do Playwright
├── auvo-sync/       # Módulo principal de sincronização
│   ├── helpers/     # dateHelper, googleMapsHelper
│   ├── services/    # auvoApiClient, auvoSyncService
│   └── types/       # Interfaces TypeScript
├── lib/             # Utilitários (Logger, Email, Prisma)
├── pages/           # Page Objects (LeadPage, LoginPage)
└── scheduler/       # Cron job (10 minutos)

tests/
└── unit/            # Testes unitários (Jest)

scripts/
└── sync-now.ts      # Sincronização manual
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
API_BASE_URL=http://localhost:3000

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

### Modo API (Webhook)
```bash
# Desenvolvimento
npm run dev

# Produção
npm run start
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

### Build e Start (Scheduler Mode)
```bash
docker-compose up -d scheduler

# Ver logs
docker-compose logs -f scheduler
```

### Build e Start (API Mode)
```bash
docker-compose up -d api

# Ver logs
docker-compose logs -f api
```

### Parar
```bash
docker-compose down
```

> **Nota:** O container usa a imagem oficial do Playwright (`mcr.microsoft.com/playwright:v1.49.0-jammy`) que já inclui os browsers necessários.

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

### `GET /health`
Verifica se o serviço está online.

```json
{ "status": "ok", "uptime": 12345 }
```

### `POST /webhook/lead`
Recebe dados do lead e retorna o ID criado no Vtiger.

**Response:**
```json
{
  "message": "Lead created successfully",
  "id": 15,
  "vtigerId": "1193203"
}
```

### `POST /webhook/lead/:id/retry`
Reprocessa um lead que falhou usando o payload salvo no banco.

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
