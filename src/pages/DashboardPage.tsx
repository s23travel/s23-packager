import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';

export const DashboardPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Painel Operacional</h1>
          <p className="page-subtitle">
            Ambiente interno para gestão do ciclo de vida de pacotes e cotações.
          </p>
        </div>
        <span className="badge badge-info">Fase 1: Fundação Concluída</span>
      </div>

      <div className="info-banner">
        <div className="info-banner-text">
          <h4>🚀 Fundação Técnica Ativa</h4>
          <p>
            O projeto está configurado com React, TypeScript, Vite e roteamento base.
            Funcionalidades de banco de dados, IA e integrações serão introduzidas nas próximas etapas.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
          Fluxo de Trabalho Previsto
        </h3>
        <div className="flow-container">
          <div className="flow-step current">1. Fundação Técnica</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">2. Modelagem Supabase</div>
          <span className="flow-arrow">→</span>
          <div className="flow-step">3. Catálogo de Pacotes</div>
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
          title="Gestão de Pacotes"
          badge="Próximo"
          description="Área destinada ao cadastro de destinos, itinerários, serviços inclusos e estrutura base dos pacotes de viagem."
        >
          <div style={{ marginTop: '1.25rem' }}>
            <Link to="/pacotes" className="btn btn-secondary" style={{ width: '100%' }}>
              Acessar Módulo
            </Link>
          </div>
        </Card>

        <Card
          title="Central de Cotações"
          badge="Em Breve"
          description="Criação e precificação personalizada de cotações para clientes a partir dos pacotes cadastrados."
        >
          <div style={{ marginTop: '1.25rem' }}>
            <Link to="/cotacoes" className="btn btn-secondary" style={{ width: '100%' }}>
              Acessar Módulo
            </Link>
          </div>
        </Card>

        <Card
          title="Status do Sistema"
          badge="Ambiente"
          description="Stack: React + TypeScript + Vite. Preparado para deploy no Cloudflare Pages e backend Supabase."
        >
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div>• Vite Dev Server: Ativo</div>
            <div>• TypeScript: Strict Mode</div>
            <div>• SPA Routing: Configurado</div>
          </div>
        </Card>
      </div>
    </div>
  );
};
