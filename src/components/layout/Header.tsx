import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavigationItem } from '../../types';

const NAV_ITEMS: NavigationItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Pacotes', path: '/pacotes', badge: 'Fase 3' },
  { label: 'Cotações', path: '/cotacoes', badge: 'Fase 4' },
];

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">S23</div>
        <div className="brand-title">S23 Packages</div>
        <span className="brand-badge">Fundação Técnica</span>
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
            {item.badge && (
              <span className="nav-link-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="system-status" title="Ambiente Operacional">
        <span className="status-indicator"></span>
        <span>Online (Local)</span>
      </div>
    </header>
  );
};
