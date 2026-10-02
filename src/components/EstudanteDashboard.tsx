import React, { useState } from 'react';
import { User, Item, Notificacao, CATEGORIAS, LOCAIS, ESTADOS_LABEL } from '../types';
import { Bell, PlusCircle, PackageCheck, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface EstudanteDashboardProps {
  user: User;
  itens: Item[];
  notificacoes: Notificacao[];
  onRefresh: () => void;
  setFeedback: (msg: { tipo: 'ok' | 'erro'; texto: string } | null) => void;
}

export const EstudanteDashboard: React.FC<EstudanteDashboardProps> = ({
  user,
  itens,
  notificacoes,
  onRefresh,
  setFeedback
}) => {
  const hoje = new Date().toISOString().split('T')[0];

  const [tipo, setTipo] = useState<'perdido' | 'achado'>(
    user.perfil === 'estudante' ? 'perdido' : 'achado'
  );
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [marca, setMarca] = useState('');
  const [cor, setCor] = useState('');
  const [localCampus, setLocalCampus] = useState(LOCAIS[0]);
  const [dataOcorrencia, setDataOcorrencia] = useState(hoje);
  const [submetendo, setSubmetendo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmetendo(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/itens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          categoria,
          marca,
          cor,
          local_campus: localCampus,
          data_ocorrencia: dataOcorrencia
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Falha ao registar o item' });
      } else {
        // Feedback automático obrigatório conforme especificação
        setFeedback({ tipo: 'ok', texto: data.feedback });
        setMarca('');
        setCor('');
        onRefresh();
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao registar' });
    } finally {
      setSubmetendo(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Bloco de Notificações Ativas da Secretaria (Match / Entrada) */}
      {notificacoes && notificacoes.length > 0 && (
        <section className="cartao cartao--notificacao">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f5132', margin: '0 0 0.5rem' }}>
            <Bell size={20} color="#0f5132" /> Notificação Oficial da Secretaria da Universidade Técnica
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {notificacoes.map((n) => (
              <div
                key={n.id}
                style={{
                  background: '#ffffff',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #c2e2d1'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 700, color: '#0f5132' }}>
                    Pertence Ref.: {n.item_codigo}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#52695c' }}>
                    {new Date(n.criada_em).toLocaleString('pt-PT')}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#1a2e24', fontWeight: 500 }}>
                  "{n.mensagem}"
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Formulário de Novo Registo */}
      <section className="cartao">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', margin: '0 0 1rem' }}>
          <PlusCircle size={20} color="#0e7048" />
          {user.perfil === 'estudante' ? 'Novo Registo de Pertence' : 'Registar Objeto/Documento Encontrado'}
        </h2>

        <form onSubmit={handleSubmit} className="form form--grade">
          {user.perfil === 'estudante' ? (
            <label>
              O que pretende registar?
              <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} required>
                <option value="perdido">Perdi um objeto/documento (Notificação de Perda)</option>
                <option value="achado">Encontrei um objeto/documento no campus</option>
              </select>
            </label>
          ) : (
            <input type="hidden" value="achado" />
          )}

          <label>
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} required>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            Marca ou Modelo
            <input
              type="text"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ex.: HP, Apple, Jansport, Samsung..."
            />
          </label>

          <label>
            Cor predominante
            <input
              type="text"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="Ex.: Preto, Azul marinho, Prateado..."
            />
          </label>

          <label>
            Local aproximado no campus
            <select value={localCampus} onChange={(e) => setLocalCampus(e.target.value)} required>
              {LOCAIS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label>
            Data da ocorrência
            <input
              type="date"
              max={hoje}
              value={dataOcorrencia}
              onChange={(e) => setDataOcorrencia(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="btn btn--primario"
            disabled={submetendo}
            style={{ width: '100%', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <PackageCheck size={18} /> {submetendo ? 'A gravar...' : 'Submeter Registo'}
          </button>
        </form>
      </section>

      {/* Tabela de Registos do Utilizador */}
      <section className="cartao">
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem' }}>Os Meus Registos no Sistema</h2>
        {itens && itens.length > 0 ? (
          <div className="tabela" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Objeto / Documento</th>
                  <th>Local</th>
                  <th>Data</th>
                  <th>Estado do Processo</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ color: '#0e7048' }}>{item.codigo}</strong>
                    </td>
                    <td>
                      {item.tipo === 'perdido' ? (
                        <span style={{ color: '#a03522', fontWeight: 600 }}>Perdido</span>
                      ) : (
                        <span style={{ color: '#0e7048', fontWeight: 600 }}>Achado</span>
                      )}
                    </td>
                    <td>
                      <strong>{item.categoria}</strong>
                      {item.marca ? ` · ${item.marca}` : ''}
                      {item.cor ? ` (${item.cor})` : ''}
                    </td>
                    <td>{item.local_campus}</td>
                    <td>{item.data_ocorrencia}</td>
                    <td>
                      <span className={`badge badge--${item.estado}`}>
                        {ESTADOS_LABEL[item.estado] || item.estado}
                      </span>

                      {item.estado === 'disponivel_levantamento' && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#0f5132', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={14} color="#0f5132" />
                          Dirija-se à Secretaria da Universidade Técnica para proceder ao levantamento e verificação de identidade.
                        </div>
                      )}

                      {item.estado === 'pendente_entrega' && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#7a5600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <AlertCircle size={14} color="#7a5600" />
                          Por favor, dirija-se à Secretaria para entregar o objeto e concluir o processo.
                        </div>
                      )}

                      {item.estado === 'aguardando_localizacao' && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#5c6b65', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={14} color="#5c6b65" />
                          Ainda não deu entrada na Secretaria. Aguarde novas atualizações.
                        </div>
                      )}

                      {item.estado === 'devolvido' && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#55665f' }}>
                          ✓ Item devolvido e processo concluído.
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="nota">Ainda não possui registos de objetos ou documentos. Preencha o formulário acima para registar.</p>
        )}
      </section>
    </div>
  );
};
