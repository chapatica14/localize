import React, { useState, useEffect } from 'react';
import { Item, CustodiaGroup, RetiradaItem } from '../types';
import { Inbox, GitCompare, CheckCircle2, ShieldAlert, Sparkles, Building2 } from 'lucide-react';

interface SecretariaDashboardProps {
  setFeedback: (msg: { tipo: 'ok' | 'erro'; texto: string } | null) => void;
}

export const SecretariaDashboard: React.FC<SecretariaDashboardProps> = ({ setFeedback }) => {
  const [abaAtiva, setAbaAtiva] = useState<'fila' | 'custodia' | 'retirada'>('fila');
  const [fila, setFila] = useState<Item[]>([]);
  const [custodia, setCustodia] = useState<CustodiaGroup[]>([]);
  const [retirada, setRetirada] = useState<RetiradaItem[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Armazenamento de inputs temporários
  const [locaisGuarda, setLocaisGuarda] = useState<Record<number, string>>({});
  const [documentosDevolucao, setDocumentosDevolucao] = useState<Record<number, string>>({});

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [resFila, resCustodia, resRetirada] = await Promise.all([
        fetch('/api/secretaria/fila'),
        fetch('/api/secretaria/custodia'),
        fetch('/api/secretaria/retirada')
      ]);

      if (resFila.ok) setFila(await resFila.json());
      if (resCustodia.ok) setCustodia(await resCustodia.json());
      if (resRetirada.ok) setRetirada(await resRetirada.json());
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao carregar dados da Secretaria' });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleReceber = async (id: number) => {
    const loc = (locaisGuarda[id] || '').trim();
    if (!loc) {
      setFeedback({ tipo: 'erro', texto: 'Indique a localização de guarda (ex.: Armário A - Gaveta 2)' });
      return;
    }

    try {
      const res = await fetch(`/api/secretaria/receber/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localizacao: loc })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ tipo: 'ok', texto: data.mensagem });
        carregarDados();
      } else {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Falha ao receber item' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao comunicar com o servidor' });
    }
  };

  const handleMatch = async (achadoId: number, perdidoId: number) => {
    try {
      const res = await fetch('/api/secretaria/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achado: achadoId, perdido: perdidoId })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ tipo: 'ok', texto: data.mensagem });
        carregarDados();
      } else {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Falha ao confirmar correspondência' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao comunicar com o servidor' });
    }
  };

  const handleDevolver = async (id: number) => {
    const doc = (documentosDevolucao[id] || '').trim();
    if (!doc) {
      setFeedback({ tipo: 'erro', texto: 'Insira o número do BI ou da Matrícula para validar a entrega' });
      return;
    }

    try {
      const res = await fetch(`/api/secretaria/devolver/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: doc })
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ tipo: 'ok', texto: data.mensagem });
        carregarDados();
      } else {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Falha ao registar devolução' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao comunicar com o servidor' });
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#133527', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={24} color="#0e7048" /> Painel de Gestão da Secretaria
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#55665f', fontSize: '0.9rem' }}>
            Gestão física de pertences, verificação de dados e entrega formal
          </p>
        </div>
        <button
          onClick={carregarDados}
          disabled={carregando}
          className="btn btn--sec"
          style={{ fontSize: '0.85rem' }}
        >
          {carregando ? 'A atualizar...' : 'Atualizar Dados'}
        </button>
      </div>

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e1e7e4', paddingBottom: '0.25rem' }}>
        <button
          onClick={() => setAbaAtiva('fila')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'fila' ? '3px solid #0e7048' : '3px solid transparent',
            color: abaAtiva === 'fila' ? '#0e7048' : '#55665f',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Inbox size={18} />
          1. Fila de Entrada ({fila.length})
        </button>

        <button
          onClick={() => setAbaAtiva('custodia')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'custodia' ? '3px solid #0e7048' : '3px solid transparent',
            color: abaAtiva === 'custodia' ? '#0e7048' : '#55665f',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <GitCompare size={18} />
          2. Correspondências & Match ({custodia.length})
        </button>

        <button
          onClick={() => setAbaAtiva('retirada')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'retirada' ? '3px solid #0e7048' : '3px solid transparent',
            color: abaAtiva === 'retirada' ? '#0e7048' : '#55665f',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <CheckCircle2 size={18} />
          3. Disponíveis para Levantamento ({retirada.length})
        </button>
      </div>

      {/* ABA 1: Fila de Entrada */}
      {abaAtiva === 'fila' && (
        <section className="cartao">
          <h3 style={{ margin: '0 0 0.5rem', color: '#133527' }}>
            1. Itens Achados com Entrega Pendente na Secretaria
          </h3>
          <p style={{ margin: '0 0 1.25rem', color: '#55665f', fontSize: '0.9rem' }}>
            Itens registados pelos utilizadores que aguardam entrega física no balcão da Secretaria. Quando o pertence for entregue, registe o local de depósito para dar entrada em custódia.
          </p>

          {fila.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {fila.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '0.85rem',
                    background: '#f9fbfa',
                    borderRadius: '0.4rem',
                    border: '1px solid #dce5e1'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: '#0e7048', fontSize: '1.05rem' }}>{item.codigo}</strong>
                      <span className="badge badge--pendente_entrega">Pendente de Entrega na Secretaria</span>
                    </div>
                    <div style={{ marginTop: '0.35rem', color: '#273831', fontSize: '0.92rem' }}>
                      <strong>{item.categoria}</strong> · {item.marca || 'Sem marca'} · {item.cor || 'Sem cor'} · {item.local_campus}
                    </div>
                    <small style={{ color: '#687b74' }}>Registado em: {item.data_ocorrencia}</small>
                  </div>

                  <input
                    type="text"
                    placeholder="Ex.: Armário B - Gaveta 3"
                    value={locaisGuarda[item.id] || ''}
                    onChange={(e) => setLocaisGuarda({ ...locaisGuarda, [item.id]: e.target.value })}
                    style={{ width: '14rem' }}
                  />

                  <button
                    onClick={() => handleReceber(item.id)}
                    className="btn btn--sec"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Receber em Custódia
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="nota">Nenhum item à espera de entrega física no momento.</p>
          )}
        </section>
      )}

      {/* ABA 2: Cruzamento de Dados e Match */}
      {abaAtiva === 'custodia' && (
        <section className="cartao">
          <h3 style={{ margin: '0 0 0.5rem', color: '#133527' }}>
            2. Cruzamento de Dados e Sugestões de Match
          </h3>
          <p style={{ margin: '0 0 1.25rem', color: '#55665f', fontSize: '0.9rem' }}>
            O sistema calcula a afinidade de atributos entre itens em custódia e notificações de perda. Ao confirmar, o estudante é notificado automaticamente para proceder ao levantamento.
          </p>

          {custodia.length > 0 ? (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {custodia.map(({ achado, cands }) => (
                <div
                  key={achado.id}
                  style={{
                    border: '1px solid #dce5e1',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    background: '#ffffff'
                  }}
                >
                  <div style={{ borderBottom: '1px solid #eef3f0', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: '#0e7048' }}>Achado {achado.codigo}</strong>
                      <span className="badge badge--em_custodia">Em custódia na Secretaria</span>
                    </div>
                    <div style={{ marginTop: '0.25rem', color: '#1f2e28' }}>
                      <strong>{achado.categoria}</strong> · {achado.marca || 'Sem marca'} · {achado.cor || 'Sem cor'} · {achado.local_campus}
                    </div>
                    <small style={{ color: '#55665f' }}>
                      <strong>Localização física:</strong> {achado.localizacao || 'Secretaria'}
                    </small>
                  </div>

                  {cands.length > 0 ? (
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 600, color: '#0e7048', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Sparkles size={14} color="#0e7048" /> Correspondências sugeridas com notificações de perda:
                      </p>
                      {cands.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto auto',
                            gap: '1rem',
                            alignItems: 'center',
                            padding: '0.65rem 0.85rem',
                            background: '#f6faf8',
                            borderRadius: '0.35rem',
                            border: '1px solid #d2e4dc'
                          }}
                        >
                          <div>
                            <strong>Perdido {c.codigo}</strong> · {c.categoria} · {c.marca || 'Sem marca'} · {c.cor || 'Sem cor'} · {c.local_campus}
                            <br />
                            <small style={{ color: '#55665f' }}>Data da perda: {c.data_ocorrencia}</small>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: c.score >= 70 ? '#0e7048' : '#7a5600' }}>
                              {c.score}%
                            </span>
                            <br />
                            <small style={{ fontSize: '0.75rem', color: '#55665f' }}>afinidade</small>
                          </div>

                          <meter
                            min="0"
                            max="100"
                            low={50}
                            high={75}
                            optimum={100}
                            value={c.score}
                            style={{ width: '6rem' }}
                          />

                          <button
                            onClick={() => handleMatch(achado.id, c.id)}
                            className="btn btn--primario"
                            style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem' }}
                          >
                            Confirmar Match & Notificar Dono
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="nota" style={{ margin: '0.5rem 0 0' }}>
                      Nenhuma notificação de perda com características coincidentes no momento.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="nota">Nenhum item em custódia na Secretaria no momento.</p>
          )}
        </section>
      )}

      {/* ABA 3: Disponíveis para Levantamento */}
      {abaAtiva === 'retirada' && (
        <section className="cartao">
          <h3 style={{ margin: '0 0 0.5rem', color: '#133527' }}>
            3. Itens Prontos para Levantamento e Validação de Identidade
          </h3>
          <p style={{ margin: '0 0 1.25rem', color: '#55665f', fontSize: '0.9rem' }}>
            O estudante foi notificado. Ao comparecer na Secretaria, confira a identidade (BI ou Cartão de Estudante/Matrícula) e registe a devolução formal.
          </p>

          {retirada.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {retirada.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '0.85rem',
                    background: '#f2f9f5',
                    borderRadius: '0.4rem',
                    border: '1px solid #b7dfcb'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: '#0f5132', fontSize: '1.05rem' }}>{item.codigo}</strong>
                      <span className="badge badge--disponivel_levantamento">Disponível para Levantamento</span>
                    </div>
                    <div style={{ marginTop: '0.3rem', color: '#1a3327' }}>
                      <strong>{item.categoria}</strong> (Cruzado com ref.: <strong>{item.cod_perdido}</strong>)
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#385346', marginTop: '0.2rem' }}>
                      <strong>Proprietário:</strong> {item.dono} | <strong>Armazenamento:</strong> {item.localizacao}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Nº do BI ou Matrícula"
                    value={documentosDevolucao[item.id] || ''}
                    onChange={(e) => setDocumentosDevolucao({ ...documentosDevolucao, [item.id]: e.target.value })}
                    style={{ width: '14rem' }}
                  />

                  <button
                    onClick={() => handleDevolver(item.id)}
                    className="btn btn--primario"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Registar Devolução
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="nota">Nenhum pertence aguardando levantamento no momento.</p>
          )}
        </section>
      )}
    </div>
  );
};
