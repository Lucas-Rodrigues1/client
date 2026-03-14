# 💬 Chat App — Client (Frontend)

Frontend do chat em tempo real construído com **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4** e **shadcn/ui**.

---

## 📸 Stack

| Tecnologia         | Versão  |
| ------------------ | ------- |
| Next.js            | 16      |
| React              | 19      |
| TypeScript         | 5       |
| Tailwind CSS       | 4       |
| shadcn/ui          | radix-nova |
| Socket.IO Client   | 4.8     |
| Lucide React       | 0.577   |

---

## ✨ Features

- **Autenticação** — Login/cadastro com JWT em cookie, indicador de força de senha
- **Chat em tempo real** — Mensagens instantâneas via Socket.IO
- **Envio de fotos** — Upload de imagem (base64, até 4MB) com preview inline
- **Emoji picker** — 48 emojis integrados na barra de mensagem (estilo WhatsApp)
- **Confirmação de leitura** — Ticks ✓✓ com toggle nas configurações
- **Indicador de digitação** — Animação de 3 bolinhas em tempo real
- **Sistema de amizades** — Busca, solicitação, aceitação, remoção com AlertDialog
- **Notificações** — Bell icon com badge para solicitações e aceitações
- **Gestão de conversas** — Arquivar, desarquivar, excluir (soft delete)
- **Perfil & status** — Upload de avatar, status (Online/Ausente/Ocupado/Offline)
- **Toast notifications** — Feedback visual de sucesso, erro e info
- **Proteção de rotas** — Middleware Next.js redireciona para login se não autenticado

---

## 🧩 Componentes shadcn/ui

| Componente     | Uso                                             |
| -------------- | ----------------------------------------------- |
| `AlertDialog`  | Confirmação ao remover amigo                    |
| `Button`       | Ações (enviar, adicionar amigo, logout, etc.)   |
| `Card`         | Container da sidebar e área de mensagens        |
| `Input`        | Campo de busca, formulários                     |
| `Textarea`     | Campo de digitação de mensagem                  |
| `Label`        | Labels dos formulários                          |
| `Separator`    | Divisores visuais                               |
| `Field`        | Wrapper de campos com validação                 |
| `FileUpload`   | Upload de avatar com drag & drop e preview      |

Adicionar novos componentes:

```bash
npx shadcn@latest add <componente>
```

---

## 📁 Estrutura

```
client/
├── app/
│   ├── layout.tsx             # Layout raiz com ToastProvider
│   ├── page.tsx               # Redirect → /login
│   ├── globals.css            # Tailwind + variáveis CSS shadcn
│   ├── login/                 # Página de login
│   ├── signup/                # Página de cadastro
│   └── dashboard/             # Chat principal
├── components/
│   ├── login-form.tsx
│   ├── signup-form.tsx
│   ├── add-friend-modal.tsx
│   ├── avatar-upload-modal.tsx
│   ├── password-strength-checker.tsx
│   └── ui/                    # Componentes shadcn/ui
├── hooks/                     # Custom hooks
├── lib/
│   ├── api.ts                 # ApiRepository (fetch + JWT)
│   ├── auth.ts                # Token/cookie management
│   ├── socket.ts              # SocketService (Socket.IO)
│   ├── use-toast.tsx          # Sistema de toasts
│   └── utils.ts               # cn() helper
├── middleware.ts              # Auth guard (JWT cookie)
├── components.json            # Config shadcn/ui
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 🚀 Como Rodar

### Pré-requisitos

- **Node.js** 20+
- **npm** 9+

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://server-6kij.onrender.com
```

> Para usar um server local, troque para `http://localhost:3000` (ou a porta onde o backend estiver rodando).

### 3. Rodar em modo dev

```bash
npm run dev
```

Acesse `http://localhost:3000`.

> **Nota:** Se o backend também estiver rodando na porta 3000 localmente, inicie o client em outra porta:
> ```bash
> npm run dev -- -p 3002
> ```

---

## 🐳 Docker

### Docker Compose

```bash
docker-compose up --build
```

O client estará em `http://localhost:3001`.

### Docker manual

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://server-6kij.onrender.com -t chat-client .
docker run -p 3001:3000 chat-client
```

> **Importante:** `NEXT_PUBLIC_*` é inlined no build do Next.js. Não é possível alterá-la via `-e` no `docker run`. Use `--build-arg` no `docker build`.

### Parar

```bash
docker-compose down
```

---

## 🔧 Scripts

| Comando         | Descrição                      |
| --------------- | ------------------------------ |
| `npm run dev`   | Modo desenvolvimento           |
| `npm run build` | Build de produção              |
| `npm run start` | Servidor de produção           |
| `npm run lint`  | ESLint                         |

---

## 📝 Variáveis de Ambiente

| Variável               | Obrigatória | Descrição                                                              |
| ---------------------- | ----------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | ❌          | URL do server. Padrão local: `http://localhost:3000`. No Docker Compose o default é `https://server-6kij.onrender.com` (via build arg). |
