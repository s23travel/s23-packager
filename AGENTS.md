# Diretrizes para Agentes de IA (AGENTS.md)

Este documento orienta agentes de IA e desenvolvedores que atuam no repositório **S23 Packages**.

## 📌 Contexto do Projeto
- **Nome**: S23 Packages
- **Propósito**: Aplicação web interna da S23 para gerenciar o workflow de pacotes de viagem e cotações.
- **Ambiente de Desenvolvimento**: Antigravity (o Antigravity é apenas o ambiente utilizado para desenvolver a aplicação, não faz parte do runtime da aplicação).

## 🧭 Princípios de Desenvolvimento
1. **Simplicidade e Objetividade**: Foco estrito no que foi solicitado para a fase corrente.
2. **Evitar Overengineering**: Não criar abstrações prematuras nem padrões excessivamente complexos.
3. **Desenvolvimento Incremental**: Não antecipar fases (não implementar integrações externas, banco, WhatsApp ou IA antes do momento acordado).
4. **Dependências Mínimas**: Não instalar bibliotecas ou frameworks sem necessidade clara e justificada.
5. **Tipagem Estrita**: Manter TypeScript estrito (`strict: true`), sem uso indevido de `any`.
6. **Desktop-First & Responsividade**: A aplicação é de uso interno e operacional diário; priorize densidade de informação limpa, rápida leitura e poucos cliques.

## 🏗️ Padrões de Estrutura
- `src/components/`: Componentes visuais desacoplados de lógica de negócio direta.
- `src/pages/`: Telas associadas às rotas.
- `src/lib/`: Instanciação e configurações de utilitários externos (ex.: Supabase).
- `src/services/`: Chamadas a serviços e manipulação de dados.
- `src/types/`: Interfaces e modelos de dados compartilhados.
- `supabase/`: Migrações SQL e funções de backend gerenciadas via CLI do Supabase.

## 🚫 O que NÃO Fazer
- Não criar regras ou agentes que alterem a arquitetura sem validação.
- Não expor chaves de API no repositório.
- Não quebrar a compatibilidade de build com Cloudflare Pages (`npm run build` deve sempre passar limpo).
