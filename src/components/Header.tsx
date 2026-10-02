import React from 'react';
import { User } from '../types';
import { LogOut, UserCheck, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onSwitchUser?: (perfil: 'estudante' | 'secretaria') => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onSwitchUser }) => {
  return (
    <header className="cabecalho" style={{ background: '#ffffff', borderBottom: '1px solid #e1e7e4', padding: '0.85rem 1.25rem', marginBottom: '1.5rem' }}>
      <div className="container" style={{ maxWidth: '64rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: '#0e7048', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 700, fontSize: '1.2rem' }}>
            L
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#133527', letterSpacing: '-0.02em' }}>
              Localize
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#55665f' }}>
              Achados e Perdidos · Universidade Técnica
            </p>
          </div>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#1f2e28', background: '#f2f6f4', padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid #d8e4df' }}>
              {user.perfil === 'secretaria' ? (
                <ShieldCheck size={16} color="#0e7048" />
              ) : (
                <UserCheck size={16} color="#0e7048" />
              )}
              <strong>{user.nome}</strong>
              <span style={{ fontSize: '0.75rem', color: '#55665f', textTransform: 'capitalize' }}>
                ({user.perfil})
              </span>
            </div>

            {onSwitchUser && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => onSwitchUser(user.perfil === 'secretaria' ? 'estudante' : 'secretaria')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    borderRadius: '0.35rem',
                    border: '1px solid #c2d5cd',
                    background: '#ffffff',
                    cursor: 'pointer',
                    color: '#0e7048'
                  }}
                  title="Trocar rápido de perfil para testes"
                >
                  Alternar para {user.perfil === 'secretaria' ? 'Estudante' : 'Secretaria'}
                </button>
              </div>
            )}

            <button
              onClick={onLogout}
              className="btn btn--sec"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
