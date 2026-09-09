import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavigationItem } from '../../types';

const NAV_ITEMS: NavigationItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Pacotes', path: '/pacotes' },
  { label: 'Cotações', path: '/cotacoes' },
];

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">S23</div>
        <div className="brand-title">Packager</div>
        <span className="brand-badge">Operacional</span>
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

      <div className="system-status" title="Banco de Dados Supabase Conectado">
        <span className="status-indicator"></span>
        <span>Supabase Conectado</span>
      </div>
    </header>
  );
};
