# S23 Compass Enterprise — Design System (MASTER.md)

> **Source of Truth** para a interface do Packager (S23 Travel).  
> **Perfil:** Back-office operacional de alta frequência, desktop-first, multi-moeda (EUR/BRL), responsivo.

---

## 1. Princípios de Design

1. **Clareza Operacional Instantânea (*Glanceability*)**: Visibilidade rápida de saldos, liquidez e status de cotações/pacotes sem esforço cognitivo.
2. **Alta Densidade Legível**: Ritmo de 4/8dp estrito, células de tabela compactas (38-42px) e alinhamento decimal perfeito com `tabular-nums`.
3. **Micro-elevação & Bordas Precisas**: Bordas de 1px (`var(--border-subtle)`) em vez de sombras exageradas.
4. **Sem Emojis Estruturais**: Uso exclusivo de ícones SVG acessíveis (`aria-hidden="true"`) e componentes semânticos (`.region-tag`, `.currency-badge`).

---

## 2. Paleta de Cores e Tokens

### Light Mode (Crisp Slate)
- `--bg-app`: `#f8fafc` (Slate 50)
- `--bg-surface`: `#ffffff` (Pure White)
- `--bg-surface-elevated`: `#f1f5f9` (Slate 100)
- `--bg-surface-hover`: `#eef2f6` (Slate 100 refinado)
- `--border-subtle`: `#e2e8f0` (Slate 200)
- `--border-strong`: `#cbd5e1` (Slate 300)
- `--border-focus`: `#2563eb` (Cobalt)
- `--text-primary`: `#0f172a` (Slate 900)
- `--text-secondary`: `#475569` (Slate 600)
- `--text-muted`: `#64748b` (Slate 500)

### Dark Mode (Deep Charcoal Navy)
- `--bg-app`: `#0b0f19` (Charcoal Blue)
- `--bg-surface`: `#111827` (Dark Slate)
- `--bg-surface-elevated`: `#1a2234` (Elevated Slate)
- `--bg-surface-hover`: `#222d44` (Hover Slate)
- `--border-subtle`: `#1f293d` (Subtle Dark Border)
- `--border-strong`: `#334155` (Slate 700)
- `--border-focus`: `#3b82f6` (Blue 500)
- `--text-primary`: `#f8fafc` (Slate 50)
- `--text-secondary`: `#cbd5e1` (Slate 300)
- `--text-muted`: `#94a3b8` (Slate 400 - Contraste WCAG AA > 4.5:1)

### Cores Semânticas
- **Primária**: Light `#2563eb` / Dark `#3b82f6`
- **Sucesso / Entradas**: Light `#059669` / Dark `#10b981`
- **Atenção / Alertas**: Light `#d97706` / Dark `#f59e0b`
- **Perigo / Saídas**: Light `#e11d48` / Dark `#f43f5e`
- **EUR (Portugal)**: Light `#4f46e5` / Dark `#818cf8`
- **BRL (Brasil)**: Light `#0d9488` / Dark `#2dd4bf`

---

## 3. Tipografia

- **Família:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Números & Moedas:** `font-variant-numeric: tabular-nums`
- **Códigos & Referências:** `font-family: inherit` ou `monospace` com badge `.business-ref`

### Escala:
- `--text-xs`: `12px` (badges, metadados)
- `--text-sm`: `13px` (tabelas, contadores)
- `--text-base`: `14px` (corpo, formulários)
- `--text-md`: `15px` (títulos de cartões)
- `--text-lg`: `18px` (cabeçalhos de seção)
- `--text-xl`: `24px` (KPIs em destaque)

---

## 4. Componentes Chave

- `.card`: Cartão padrão com borda fina e sombra sutil.
- `.metric-card`: Mini-cards de KPIs financeiros.
- `.data-table`: Tabela compacta com cabeçalho sticky discreto e hover claro.
- `.currency-badge`: Pílula de identificação de moeda (`--eur` e `--brl`).
- `.region-tag`: Tag com sigla de país (`PT` / `BR`).
- `.btn`: Botões compactos (`.btn-primary`, `.btn-secondary`, `.btn-danger-outline`, `.btn-sm`).
