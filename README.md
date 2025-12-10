# Auvo to Vtiger Leads Integration

Integração automática de Leads do sistema **Auvo** para o CRM **Vtiger** usando automação via **Playwright**.

## 🚀 Funcionalidades

- **Webhook Síncrono**: Recebe dados do Auvo (via N8N), processa e retorna o ID do lead criado.
- **Automação Inteligente**: Playwright preenche o formulário no Vtiger automaticamente.
- **Lógica de Cidade Polo**: Extrai "Cidade Polo" e "Responsável" a partir do `userFromName`.
- **Notificação de Erro**: Envia e-mail com link para reprocessar em caso de falha.
- **Endpoint de Retry**: Reprocessa leads que falharam via `POST /webhook/lead/:id/retry`.

## 🛠️ Tecnologias

- **Node.js** & **TypeScript**
- **Playwright** (Automação E2E)
- **Express** (API)
- **PostgreSQL** + **Prisma** (ORM)

## ⚙️ Configuração

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Configure as Variáveis de Ambiente** (`.env`):
   ```env
   # CRM
   CRM_URL=https://crm.purifikar.com.br/
   CRM_USERNAME=seu_usuario
   CRM_PASSWORD=sua_senha

   # API
   API_BASE_URL=http://localhost:3000

   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/auvo_leads?schema=public

   # Email (Notificações de erro)
   ERROR_EMAIL_TO=admin@purifikar.com.br
   SMTP_HOST=smtp.exemplo.com
   SMTP_PORT=465
   SMTP_USER=email@exemplo.com
   SMTP_PASS=senha_email
   SMTP_SECURE=true
   ```

3. **Banco de Dados**:
   ```bash
   npx prisma db push
   ```

## 🚀 Como Rodar

```bash
npm run dev
```

## 📡 Endpoints

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

## 📂 Estrutura do Projeto

```
src/
├── api/             # Servidor Express (Webhook)
├── automation/      # Scripts do Playwright
├── lib/             # Utilitários (Logger, Email, Prisma)
└── pages/           # Page Objects (LeadPage, LoginPage)
```
