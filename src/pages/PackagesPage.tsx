import React from 'react';
import { Link } from 'react-router-dom';

export const PackagesPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pacotes de Viagem</h1>
          <p className="page-subtitle">
            Gerenciamento e estruturação do portfólio de pacotes da S23.
          </p>
        </div>
        <span className="badge badge-neutral">Módulo Planejado para a Fase 3</span>
      </div>

      <div className="placeholder-view">
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📦</div>
        <h3>Módulo de Pacotes em Preparação</h3>
        <p>
          Esta área receberá futuramente o catálogo de pacotes, itinerários detalhados,
          fornecedores e precificação base após a conclusão da modelagem de dados no Supabase.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
          <Link to="/" className="btn btn-secondary">
            Voltar ao Dashboard
          </Link>
          <Link to="/cotacoes" className="btn btn-primary">
            Ver Central de Cotações
          </Link>
        </div>
      </div>
    </div>
  );
};
