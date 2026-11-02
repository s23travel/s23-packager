import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { PackagesListPage } from './pages/packages/PackagesListPage';
import { PackageFormPage } from './pages/packages/PackageFormPage';
import { PackageDetailPage } from './pages/packages/PackageDetailPage';
import { QuotesListPage } from './pages/quotes/QuotesListPage';
import { QuoteFormPage } from './pages/quotes/QuoteFormPage';
import { QuoteDetailPage } from './pages/quotes/QuoteDetailPage';
import { QuotationFinancialPage } from './pages/quotes/QuotationFinancialPage';
import { FinancialPage } from './pages/financial/FinancialPage';
import { ServicesListPage } from './pages/services/ServicesListPage';
import { ServiceFormPage } from './pages/services/ServiceFormPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { supabase } from './lib/supabase';

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession?.user.is_anonymous ? null : nextSession);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <main className="login-shell" role="status">Verificando sessão...</main>;
  }

  if (!session) return <LoginPage />;

  return (
    <div className="app-shell">
      <Header email={session.user.email} />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          
          {/* Rotas de Pacotes */}
          <Route path="/pacotes" element={<PackagesListPage />} />
          <Route path="/pacotes/novo" element={<PackageFormPage />} />
          <Route path="/pacotes/:id" element={<PackageDetailPage />} />
          <Route path="/pacotes/:id/editar" element={<PackageFormPage />} />

          {/* Rotas de Cotações */}
          <Route path="/cotacoes" element={<QuotesListPage />} />
          <Route path="/cotacoes/novo" element={<QuoteFormPage />} />
          <Route path="/cotacoes/:id" element={<QuoteDetailPage />} />
          <Route path="/cotacoes/:id/editar" element={<QuoteFormPage />} />
          <Route path="/cotacoes/:id/financeiro" element={<QuotationFinancialPage />} />

          {/* Ambiente Financeiro Global */}
          <Route path="/financeiro" element={<FinancialPage />} />

          {/* Rotas de Serviços (Catálogo) */}
          <Route path="/servicos" element={<ServicesListPage />} />
          <Route path="/servicos/novo" element={<ServiceFormPage />} />
          <Route path="/servicos/:id/editar" element={<ServiceFormPage />} />

          {/* Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <div>
          <strong>Packager</strong> &copy; {new Date().getFullYear()} — S23 Travel Operations
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          Gestão de Pacotes &amp; Cotações
        </div>
      </footer>
    </div>
  );
};
