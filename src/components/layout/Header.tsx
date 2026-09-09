import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { NavigationItem } from '../../types';
import { useTheme } from '../../lib/theme';

const NAV_ITEMS: NavigationItem[] = [
  { label: 'Visão Geral', path: '/' },
  { label: 'Pacotes', path: '/pacotes' },
  { label: 'Cotações', path: '/cotacoes' },
];

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

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
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title="Alternar tema"
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>

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

