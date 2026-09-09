import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { NavigationItem } from '../../types';

const NAV_ITEMS: NavigationItem[] = [
  { label: 'Visão Geral', path: '/' },
  { label: 'Pacotes', path: '/pacotes' },
  { label: 'Cotações', path: '/cotacoes' },
];

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <Link to="/" className="brand-section" style={{ textDecoration: 'none' }}>
          <div className="brand-logo">S23</div>
          <div className="brand-title">Packager</div>
        </Link>
      </div>

      <nav className="nav-menu" aria-label="Navegação Principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="header-right">
        <Link to="/pacotes/novo" className="btn btn-sm btn-secondary" title="Cadastrar novo pacote base">
          + Novo Pacote
        </Link>
        <Link to="/cotacoes/novo" className="btn btn-sm btn-action-primary" title="Emitir nova cotação">
          + Nova Cotação
        </Link>
      </div>
    </header>
  );
};
