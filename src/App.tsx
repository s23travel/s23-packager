import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { PackagesPage } from './pages/PackagesPage';
import { QuotesPage } from './pages/QuotesPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <div className="app-shell">
      <Header />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pacotes" element={<PackagesPage />} />
          <Route path="/cotacoes" element={<QuotesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <div>
          <strong>Packager</strong> &copy; {new Date().getFullYear()} — Ferramenta Interna de Operações S23
        </div>
        <div>
          Versão 0.1.0 (Fundação Técnica) • Cloudflare Pages Ready
        </div>
      </footer>
    </div>
  );
};
