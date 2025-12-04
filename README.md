# Auvo to Vtiger Leads Integration

Este projeto realiza a integração automática de Leads do sistema **Auvo** para o CRM **Vtiger**. Ele utiliza uma arquitetura baseada em filas para garantir que nenhum lead seja perdido e automação via **Playwright** para preencher o formulário no CRM.

## 🚀 Funcionalidades

- **Recebimento de Webhook**: API para receber dados do Auvo (via N8N).
- **Fila de Processamento**: Utiliza Redis e BullMQ para enfileirar as solicitações.
- **Automação Inteligente**: Worker que executa o Playwright para inserir os dados no Vtiger.
- **Lógica de Cidade Polo**: Extrai automaticamente a "Cidade Polo" e o "Responsável" a partir do nome do usuário (`userFromName`).
- **Notificação de Erro**: Envia e-mails caso ocorra falha na inserção do lead.
- **Containerização**: Pronto para rodar com Docker e Docker Compose.

## 🛠️ Tecnologias

- **Node.js** & **TypeScript**
- **Playwright** (Automação E2E)
- **Express** (API)
- **BullMQ** & **Redis** (Fila)
- **PostgreSQL** (Logs de requisições)
- **Prisma** (ORM)
- **Docker** & **Docker Compose**

## 📋 Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose instalados.
- [Node.js](https://nodejs.org/) (versão 18 ou superior) para desenvolvimento local.

## ⚙️ Configuração

1.  **Clone o repositório** e instale as dependências:
    ```bash
    npm install
    ```

2.  **Configure as Variáveis de Ambiente**:
    Crie um arquivo `.env` na raiz do projeto (baseado no exemplo abaixo):

    ```env
    # CRM Configuration
    CRM_URL=https://crm.purifikar.com.br/index.php
    CRM_USERNAME=seu_usuario
    CRM_PASSWORD=sua_senha

    # Database Configuration (PostgreSQL)
    DATABASE_URL=postgresql://user:password@localhost:5432/auvo_leads?schema=public

    # Redis Configuration
    REDIS_HOST=localhost
    REDIS_PORT=6379

    # Email Configuration (Para notificações de erro)
    ERROR_EMAIL_TO=admin@purifikar.com.br
    SMTP_HOST=smtp.exemplo.com
    SMTP_PORT=587
    SMTP_USER=email@exemplo.com
    SMTP_PASS=senha_email
    SMTP_SECURE=false
    ```

3.  **Banco de Dados**:
    Se estiver rodando localmente, certifique-se de que o Postgres está rodando e execute:
    ```bash
    npx prisma db push
    ```

## 🚀 Como Rodar

### Via Docker (Recomendado para Produção)

Suba todo o ambiente (API, Worker, Redis) com um único comando:

```bash
docker-compose up -d --build
```

### Manualmente (Desenvolvimento)

1.  Suba o Redis (se não tiver um local):
    ```bash
    docker-compose up redis -d
    ```

2.  Inicie a API (Terminal 1):
    ```bash
    npm run dev
    ```

3.  Inicie o Worker (Terminal 2):
    ```bash
    npm run worker
    ```

## 🧪 Testes

### Testar Webhook
Para simular o envio de um lead (usando o JSON de exemplo em `N8N Auvo docs/n8n structure.json`):

```bash
npx ts-node scripts/test-webhook.ts
```

### Testes Unitários
Para verificar a lógica de extração de Cidade Polo e Responsável:

```bash
npx ts-node tests/unit/cityPolo.test.ts
```

## 📂 Estrutura do Projeto

```
/
├── src/
│   ├── api/             # Servidor Express (Webhook)
│   ├── automation/      # Scripts do Playwright (createLead.ts)
│   ├── lib/             # Utilitários (Logger, Email, Prisma)
│   ├── pages/           # Page Objects do Playwright (LeadPage, LoginPage)
│   ├── queue/           # Configuração do BullMQ
│   └── worker/          # Processador da fila
├── prisma/              # Schema do Banco de Dados
├── scripts/             # Scripts de teste e utilitários
├── tests/               # Testes unitários e E2E
├── docker-compose.yml   # Orquestração de containers
└── Dockerfile           # Imagem da aplicação
```
