import React, { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError('Não foi possível entrar. Confira seu e-mail e senha e tente novamente.');
      }
    } catch {
      setError('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-section login-brand">
          <div className="brand-logo">S23</div>
          <span className="brand-title">Packager</span>
        </div>
        <h1 id="login-title">Entrar no Packager</h1>
        <p className="login-description">Acesse com seu e-mail e senha cadastrados.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" autoComplete="username" required
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Senha</label>
            <input id="login-password" type="password" autoComplete="current-password" required
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {!isSupabaseConfigured && <p className="login-error" role="alert">O acesso não está configurado. Contate o responsável pelo sistema.</p>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading || !isSupabaseConfigured}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
};
