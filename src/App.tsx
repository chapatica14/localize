import React, { useState, useEffect, useCallback } from 'react';
import { User, Item, Notificacao } from './types';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { EstudanteDashboard } from './components/EstudanteDashboard';
import { SecretariaDashboard } from './components/SecretariaDashboard';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregarDadosUtilizador = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setItens(data.itens || []);
        setNotificacoes(data.notificacoes || []);
      } else {
        setUser(null);
        setItens([]);
        setNotificacoes([]);
      }
    } catch {
      setUser(null);
    } finally {
      setCarregandoSessao(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosUtilizador();
  }, [carregarDadosUtilizador]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignorar erro de rede no logout
    }
    setUser(null);
    setItens([]);
    setNotificacoes([]);
    setFeedback({ tipo: 'ok', texto: 'Sessão terminada com sucesso.' });
  };

  const handleSwitchUser = async (novoPerfil: 'estudante' | 'secretaria') => {
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: novoPerfil })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setFeedback({ tipo: 'ok', texto: `Sessão alterada para ${data.user.nome} (${data.user.perfil}).` });
        carregarDadosUtilizador();
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Falha ao trocar de utilizador' });
    }
  };

  if (carregandoSessao) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f6', color: '#55665f' }}>
        <p>A carregar o sistema Localize...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7f6' }}>
      <Header
        user={user}
        onLogout={handleLogout}
        onSwitchUser={user ? handleSwitchUser : undefined}
      />

      <main className="container" style={{ maxWidth: '64rem', margin: '0 auto', padding: '0 1rem 3rem', flex: 1, width: '100%' }}>
        {feedback && (
          <div
            className={`aviso aviso--${feedback.tipo}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              animation: 'fadeIn 0.2s ease-in'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {feedback.tipo === 'ok' ? (
                <CheckCircle2 size={18} color="#0e7048" />
              ) : (
                <AlertTriangle size={18} color="#a03522" />
              )}
              <span>{feedback.texto}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {!user ? (
          <LoginView
            onSuccess={(u) => {
              setUser(u);
              carregarDadosUtilizador();
            }}
            setFeedback={setFeedback}
          />
        ) : user.perfil === 'secretaria' ? (
          <SecretariaDashboard setFeedback={setFeedback} />
        ) : (
          <EstudanteDashboard
            user={user}
            itens={itens}
            notificacoes={notificacoes}
            onRefresh={carregarDadosUtilizador}
            setFeedback={setFeedback}
          />
        )}
      </main>

      <footer style={{ borderTop: '1px solid #e1e7e4', padding: '1.5rem', background: '#ffffff', textAlign: 'center', fontSize: '0.85rem', color: '#687b74', marginTop: 'auto' }}>
        <p style={{ margin: 0 }}>
          <strong>Localize</strong> · Sistema Oficial de Achados e Perdidos da Universidade Técnica
        </p>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
          Secretaria Geral · Atendimento de Segunda a Sexta, das 08h às 18h · Base de Dados SQLite persistente (<code>localize.db</code>)
        </p>
      </footer>
    </div>
  );
};
