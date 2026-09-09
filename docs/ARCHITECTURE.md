# Arquitetura e Visão Técnica - Packager

## 1. Visão Geral

O **Packager** é uma ferramenta interna focada em otimizar a criação, precificação e distribuição de pacotes e cotações da S23.

### Fluxo Operacional Futuro
```
[Pacote Base]
     │
     ▼
[Cotação Personalizada]
     │
     ▼
[Cálculos Financeiros]
     │
     ├──► [Mensagem WhatsApp Formatada]
     ├──► [Conteúdo do Website]
     ├──► [Geração de Markdown]
     └──► [Sincronização S23 Manager]
```

---

## 2. Camadas do Sistema

### Frontend (SPA)
- **Framework**: React 18 com TypeScript em modo estrito.
- **Build Tool**: Vite (otimizado para fast refresh local e bundles ultra rápidos para deploy estático).
- **Roteamento**: React Router (com suporte a fallback SPA `_redirects` no Cloudflare Pages).
- **Design**: CSS modularizado com tokens semânticos (sem excesso de camadas utilitárias ou dependências de terceiros pesadas).

### Backend e Dados (Futuro)
- **Supabase**: PostgreSQL gerenciado para persistência relacional de pacotes, itinerários, cotações e tabelas de preços.
- **Edge Functions**: Execução serverless rápida para integrações futuras.

### Hospedagem
- **Cloudflare Pages**: Hospedagem global de alta performance para a aplicação estática com baixíssima latência.

---

## 3. Estratégia de Evolução Incremental

1. **Fase 1 (Atual)**: Fundação técnica, ambiente, roteamento básico e design tokens.
2. **Fase 2**: Modelagem de dados Supabase e migrations base.
3. **Fase 3**: Gestão de Pacotes (CRUD inicial e catálogo).
4. **Fase 4**: Motor de Cotações e Cálculos.
5. **Fase 5**: Exportações (WhatsApp, Markdown, Website, S23 Manager).
