# S23 Packages

Aplicação web interna para gerenciamento do workflow de criação de pacotes de viagem e cotações da S23.

> **Aviso**: O projeto está em sua etapa de fundação técnica. Funcionalidades de negócio, persistência com banco de dados, IA, cotações automáticas e integrações serão implementadas de forma estritamente incremental nas próximas fases.

---

## 🚀 Objetivo

Centralizar e padronizar o ciclo de vida operacional da S23:
```text
Pacote → Cotação → Cálculos financeiros → Mensagem WhatsApp → Conteúdo do website → Geração de Markdown → S23 Manager
```

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 18, TypeScript, Vite
- **Roteamento**: React Router (SPA)
- **Estilização**: Vanilla CSS com variáveis modernas (design system leve, rápido e desktop-first)
- **Backend Futuro**: Supabase (PostgreSQL / Edge Functions)
- **Hospedagem Futura**: Cloudflare Pages
- **Versionamento**: GitHub

---

## 📁 Estrutura Básica do Projeto

```text
packager/
├── .github/
│   └── workflows/       # CI/CD futuro
├── docs/                # Documentação técnica e arquitetura
├── public/              # Ativos estáticos e regra _redirects para Cloudflare Pages
├── src/
│   ├── components/      # Componentes de interface compartilhados (layout, common)
│   ├── lib/             # Clientes e utilitários (Supabase, helpers)
│   ├── pages/           # Telas da aplicação (Dashboard, Pacotes, Cotações)
│   ├── services/        # Camada de serviços (futuras chamadas de API)
│   ├── types/           # Definições de tipos TypeScript
│   ├── App.tsx          # Casca da aplicação e roteamento
│   ├── index.css        # Variáveis e design system global
│   └── main.tsx         # Ponto de entrada React
├── supabase/
│   ├── functions/       # Futuras Edge Functions
│   └── migrations/      # Futuras migrações SQL
├── .env.example         # Exemplo de configuração de variáveis
└── package.json
```

---

## 💻 Como Instalar e Executar

### Pré-requisitos
- Node.js 18+ (recomendado Node 20+)
- npm 9+

### Instalação
```bash
npm install
```

### Executar em Desenvolvimento Local
```bash
npm run dev
```
Acesse a aplicação no navegador em `http://localhost:5173`.

### Gerar Build de Produção
```bash
npm run build
```
Os artefatos estáticos otimizados serão gerados no diretório `dist/`, prontos para deploy no Cloudflare Pages.

### Pré-visualizar o Build Localmente
```bash
npm run preview
```
