import React, { useState } from 'react';
import { User } from '../types';
import { LogIn, UserPlus, KeyRound, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onSuccess: (user: User) => void;
  setFeedback: (msg: { tipo: 'ok' | 'erro'; texto: string } | null) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, setFeedback }) => {
  const [modo, setModo] = useState<'login' | 'registo'>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [perfil, setPerfil] = useState<'estudante' | 'comunidade'>('estudante');
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Falha ao iniciar sessão' });
      } else {
        setFeedback({ tipo: 'ok', texto: `Bem-vindo(a), ${data.user.nome}!` });
        onSuccess(data.user);
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de ligação ao servidor' });
    } finally {
      setCarregando(false);
    }
  };

  const handleRegisto = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, perfil })
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Falha ao registar conta' });
      } else {
        setFeedback({ tipo: 'ok', texto: `Conta criada com sucesso! Bem-vindo(a), ${data.user.nome}.` });
        onSuccess(data.user);
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de ligação ao servidor' });
    } finally {
      setCarregando(false);
    }
  };

  const handleDemo = async (perfilDemo: 'estudante' | 'secretaria') => {
    setCarregando(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: perfilDemo })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ tipo: 'ok', texto: `Sessão iniciada como ${data.user.nome} (${data.user.perfil}).` });
        onSuccess(data.user);
      } else {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Erro no login demo' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de ligação ao servidor' });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ maxWidth: '30rem', margin: '2rem auto' }}>
      <div className="cartao" style={{ boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e1e7e4', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setModo('login')}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: modo === 'login' ? '3px solid #0e7048' : '3px solid transparent',
              color: modo === 'login' ? '#0e7048' : '#6c7a74',
              cursor: 'pointer'
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setModo('registo')}
            style={{
              flex: 1,
              padding: '0.75rem',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: modo === 'registo' ? '3px solid #0e7048' : '3px solid transparent',
              color: modo === 'registo' ? '#0e7048' : '#6c7a74',
              cursor: 'pointer'
            }}
          >
            Criar conta
          </button>
        </div>

        {modo === 'login' ? (
          <form onSubmit={handleLogin} className="form">
            <label>
              Email institucional ou pessoal
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@campus.local"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            <button className="btn btn--primario" disabled={carregando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
              <LogIn size={18} /> {carregando ? 'A entrar...' : 'Iniciar sessão'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisto} className="form">
            <label>
              Nome completo
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Maria Silva"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@campus.local"
              />
            </label>
            <label>
              Perfil
              <select value={perfil} onChange={(e) => setPerfil(e.target.value as any)}>
                <option value="estudante">Estudante da Universidade Técnica</option>
                <option value="comunidade">Comunidade Externa / Visitante</option>
              </select>
            </label>
            <label>
              Criar senha (mínimo 6 caracteres)
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </label>
            <button className="btn btn--primario" disabled={carregando} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
              <UserPlus size={18} /> {carregando ? 'A criar conta...' : 'Concluir registo e entrar'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #e1e7e4' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#55665f', textAlign: 'center', fontWeight: 600 }}>
            <Sparkles size={14} style={{ display: 'inline', verticalAlign: '-2px', color: '#0e7048' }} /> Acesso Rápido de Teste (1 clique)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn--sec"
              onClick={() => handleDemo('estudante')}
              disabled={carregando}
              style={{ fontSize: '0.82rem', padding: '0.5rem' }}
            >
              🎓 Entrar como Estudante
            </button>
            <button
              type="button"
              className="btn btn--sec"
              onClick={() => handleDemo('secretaria')}
              disabled={carregando}
              style={{ fontSize: '0.82rem', padding: '0.5rem' }}
            >
              🏢 Entrar como Secretaria
            </button>
          </div>
          <p style={{ margin: '0.65rem 0 0', fontSize: '0.75rem', color: '#7a8984', textAlign: 'center' }}>
            Credenciais pré-configuradas no banco SQLite <code>localize.db</code>
          </p>
        </div>
      </div>
    </div>
  );
};
