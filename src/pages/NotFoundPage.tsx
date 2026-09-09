import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="placeholder-view" style={{ marginTop: '4rem' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
      <h3>Página Não Encontrada</h3>
      <p>A rota solicitada não existe na aplicação S23 Packages.</p>
      <Link to="/" className="btn btn-primary">
        Retornar ao Dashboard
      </Link>
    </div>
  );
};
