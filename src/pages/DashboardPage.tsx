import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { packagesService } from '../services/packagesService';
import { quotationsService } from '../services/quotationsService';

export const DashboardPage: React.FC = () => {
  const [packagesCount, setPackagesCount] = useState<number | null>(null);
  const [quotesCount, setQuotesCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [pkgs, qts] = await Promise.all([
          packagesService.listPackages(),
          quotationsService.listQuotations(),
        ]);
        setPackagesCount(pkgs.length);
        setQuotesCount(qts.length);
      } catch (e) {
        console.error('Erro ao carregar contagens:', e);
      }
    }
    fetchCounts();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel Operacional</h1>
          <p className="page-subtitle">
            Gestão integrada do catálogo de pacotes base e geração de cotações autônomas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/pacotes/novo" className="btn btn-secondary">
            + Novo Pacote
          </Link>
          <Link to="/cotacoes/novo" className="btn btn-primary">
            + Nova Cotação Avulsa
          </Link>
        </div>
      </div>

      <div className="info-banner">
        <div className="info-banner-text">
          <h4>🚀 Fase 3 Ativa: CRUD Completo & Clonagem de Cotações</h4>
          <p>
            Pacotes e cotações estão integrados ao Supabase. Cotações criadas a partir de pacotes
            geram snapshots independentes no campo JSONB, garantindo autonomia histórica total.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
          Fluxo de Trabalho Operacional
        </h3>
        <div className="flow-container">
          <div className="flow-step">1. Fundação Técnica</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">2. Modelagem Supabase</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step current">3. CRUD & Clonagem Snapshot</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">4. Motor de Cotações</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">5. Cálculos Financeiros</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">6. WhatsApp & Markdown</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">7. S23 Manager</div>
        </div>
      </div>

      <div className="grid-cols-3">
        <Card
          title="Catálogo de Pacotes"
          badge={packagesCount !== null ? `${packagesCount} cadastrado(s)` : 'Carregando...'}
          description="Gestão dos pacotes base, itinerários de referência, hotelaria e parâmetros de precificação."
        >
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
            <Link to="/pacotes" className="btn btn-primary" style={{ flex: 1 }}>
              Ver Pacotes
            </Link>
            <Link to="/pacotes/novo" className="btn btn-secondary" title="Cadastrar novo pacote">
              +
            </Link>
          </div>
        </Card>

        <Card
          title="Central de Cotações"
          badge={quotesCount !== null ? `${quotesCount} emitida(s)` : 'Carregando...'}
          description="Cotações comerciais com snapshot independente derivado de pacotes ou propostas avulsas."
        >
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
            <Link to="/cotacoes" className="btn btn-primary" style={{ flex: 1 }}>
              Ver Cotações
            </Link>
            <Link to="/cotacoes/novo" className="btn btn-secondary" title="Nova cotação avulsa">
              +
            </Link>
          </div>
        </Card>

        <Card
          title="Conexão Supabase"
          badge="PostgreSQL Ativo"
          description="Tabelas packages e quotations operando com RLS ativo e persistência relacional validada."
        >
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div>• Projeto: <code>iqtfqitquykasvfybndl</code></div>
            <div>• RLS Policies: CRUD Ativo</div>
            <div>• Snapshot: JSONB Autônomo</div>
          </div>
        </Card>
      </div>
    </div>
  );
};
