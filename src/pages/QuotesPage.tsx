import React from 'react';
import { Link } from 'react-router-dom';

export const QuotesPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Cotações</h1>
          <p className="page-subtitle">
            Criação ágil e precificação de cotações personalizadas para clientes.
          </p>
        </div>
        <span className="badge badge-neutral">Módulo Planejado para a Fase 4</span>
      </div>

      <div className="placeholder-view">
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
        <h3>Módulo de Cotações em Preparação</h3>
        <p>
          Esta área conectará os pacotes aos clientes, calculando margens,
          gerando mensagens formatadas para WhatsApp e exportações Markdown.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
          <Link to="/" className="btn btn-secondary">
            Voltar ao Dashboard
          </Link>
          <Link to="/pacotes" className="btn btn-primary">
            Ver Pacotes
          </Link>
        </div>
      </div>
    </div>
  );
};
