import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  initDatabase,
  query,
  queryOne,
  run,
  Usuario,
  Item,
  Notificacao
} from './src/db';

declare module 'express-session' {
  interface SessionData {
    uid?: number;
    nome?: string;
    perfil?: 'estudante' | 'comunidade' | 'secretaria';
    token?: string;
  }
}

// Token fallback storage for iframe environments
const tokenStore = new Map<string, { uid: number; nome: string; perfil: 'estudante' | 'comunidade' | 'secretaria' }>();

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function norm(t?: string | null): string {
  return (t || '').trim().toLowerCase();
}

function similaridade(a: Item, b: Item): number {
  let s = 0;
  if (a.categoria === b.categoria) s += 40;
  if (norm(a.marca) && norm(a.marca) === norm(b.marca)) s += 25;
  if (norm(a.cor) && norm(a.cor) === norm(b.cor)) s += 20;
  if (a.local_campus === b.local_campus) s += 15;
  return s;
}

async function startServer() {
  await initDatabase();
  console.log('Base de dados SQLite (localize.db) inicializada com sucesso.');

  const app = express();

  // Trust proxy for Cloud Run and secure cookies
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Session configuration with cross-origin iframe support
  app.use(session({
    name: 'localize_sid',
    secret: process.env.SECRET_KEY || 'localize-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
      httpOnly: true
    }
  }));

  // Token fallback middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const token = (req.query.token as string) || (req.headers['x-session-token'] as string);
    if (token && tokenStore.has(token)) {
      const data = tokenStore.get(token)!;
      req.session.uid = data.uid;
      req.session.nome = data.nome;
      req.session.perfil = data.perfil;
      req.session.token = token;
    }
    next();
  });

  // Serve static assets (CSS, etc.)
  app.use('/static', express.static(path.resolve('static')));

  // ==========================================
  // ROTAS DA API REST (Backend Express + SQLite)
  // ==========================================

  // Status da sessão e dados do utilizador
  app.get('/api/auth/me', (req: Request, res: Response) => {
    if (!req.session.uid) {
      return res.status(401).json({ autenticado: false });
    }

    const user = queryOne<Usuario>(
      "SELECT id, nome, email, perfil FROM usuarios WHERE id = ?",
      [req.session.uid]
    );

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ autenticado: false });
    }

    const itens = query<Item>(
      "SELECT * FROM itens WHERE usuario_id = ? ORDER BY id DESC",
      [req.session.uid]
    );

    const notificacoes = query<Notificacao>(
      "SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY id DESC",
      [req.session.uid]
    );

    return res.json({
      autenticado: true,
      user,
      itens,
      notificacoes,
      token: req.session.token
    });
  });

  // Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const emailNorm = (req.body.email || '').trim().toLowerCase();
    const senhaStr = req.body.senha || '';

    const user = queryOne<Usuario>(
      "SELECT * FROM usuarios WHERE email = ?",
      [emailNorm]
    );

    if (user && bcrypt.compareSync(senhaStr, user.senha_hash)) {
      const token = generateToken();
      tokenStore.set(token, { uid: user.id, nome: user.nome, perfil: user.perfil });

      req.session.uid = user.id;
      req.session.nome = user.nome;
      req.session.perfil = user.perfil;
      req.session.token = token;

      req.session.save((err) => {
        if (err) console.error('Erro ao guardar sessão:', err);
        return res.json({
          ok: true,
          user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil },
          token
        });
      });
      return;
    }

    return res.status(401).json({ erro: 'Email ou senha incorretos.' });
  });

  // Registo
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { nome, email, senha, perfil } = req.body;
    const perfilStr = (perfil || '').trim() as 'estudante' | 'comunidade';
    const senhaStr = (senha || '');
    const emailNorm = (email || '').trim().toLowerCase();
    const nomeStr = (nome || '').trim();

    if (perfilStr !== 'estudante' && perfilStr !== 'comunidade' || senhaStr.length < 6) {
      return res.status(400).json({ erro: 'Escolha um perfil e use uma senha com pelo menos 6 caracteres.' });
    }

    const existing = queryOne("SELECT id FROM usuarios WHERE email = ?", [emailNorm]);
    if (existing) {
      return res.status(400).json({ erro: 'Este email já tem uma conta registada.' });
    }

    const hash = bcrypt.hashSync(senhaStr, 10);
    const { lastInsertRowid } = run(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
      [nomeStr, emailNorm, hash, perfilStr]
    );

    const token = generateToken();
    tokenStore.set(token, { uid: lastInsertRowid, nome: nomeStr, perfil: perfilStr });

    req.session.uid = lastInsertRowid;
    req.session.nome = nomeStr;
    req.session.perfil = perfilStr;
    req.session.token = token;

    req.session.save((err) => {
      if (err) console.error('Erro ao guardar sessão:', err);
      return res.json({
        ok: true,
        user: { id: lastInsertRowid, nome: nomeStr, email: emailNorm, perfil: perfilStr },
        token
      });
    });
  });

  // Login Demo de 1 clique
  app.post('/api/auth/demo', (req: Request, res: Response) => {
    const perfilDemo = req.body.perfil === 'secretaria' ? 'secretaria' : 'estudante';
    const user = queryOne<Usuario>("SELECT * FROM usuarios WHERE perfil = ? LIMIT 1", [perfilDemo]);

    if (user) {
      const token = generateToken();
      tokenStore.set(token, { uid: user.id, nome: user.nome, perfil: user.perfil });

      req.session.uid = user.id;
      req.session.nome = user.nome;
      req.session.perfil = user.perfil;
      req.session.token = token;

      req.session.save((err) => {
        if (err) console.error('Erro ao guardar sessão:', err);
        return res.json({
          ok: true,
          user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil },
          token
        });
      });
      return;
    }

    return res.status(404).json({ erro: 'Utilizador demo não encontrado.' });
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = req.session.token;
    if (token) tokenStore.delete(token);
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // FLUXO 1 & FLUXO 2: Registo de Pertence (Achado / Perdido)
  app.post('/api/itens', (req: Request, res: Response) => {
    if (!req.session.uid) {
      return res.status(401).json({ erro: 'Precisa de iniciar sessão.' });
    }

    const { tipo, categoria, marca, cor, local_campus, data_ocorrencia } = req.body;
    const perfil = req.session.perfil;

    if ((tipo !== 'perdido' && tipo !== 'achado') || (tipo === 'perdido' && perfil !== 'estudante')) {
      return res.status(400).json({ erro: 'Tipo de registo inválido para o seu perfil.' });
    }

    // Regra de estados obrigatórios:
    const estadoInicial = tipo === 'achado' ? 'pendente_entrega' : 'aguardando_localizacao';

    // Gerar código único baseado no total de itens
    const countRes = queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM itens");
    const nextSeq = (countRes?.total || 0) + 1;
    const codigo = `LOC-${String(nextSeq).padStart(4, '0')}`;

    const { lastInsertRowid } = run(
      `INSERT INTO itens (codigo, tipo, categoria, marca, cor, local_campus, data_ocorrencia, estado, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        tipo,
        categoria,
        (marca || '').trim(),
        (cor || '').trim(),
        local_campus,
        data_ocorrencia,
        estadoInicial,
        req.session.uid
      ]
    );

    // Mensagens automáticas obrigatórias:
    let feedback = '';
    if (tipo === 'achado') {
      // 1. Fluxo de quem encontrou um objeto/documento
      feedback = `[${codigo}] Obrigado pelo registo! Por favor, dirija-se à Secretaria da Universidade Técnica para entregar o objeto/documento e concluir o processo.`;
    } else {
      // 2. Fluxo de quem perdeu um objeto/documento
      feedback = `[${codigo}] Sua notificação foi registada com sucesso. O seu objeto/documento ainda não deu entrada na Secretaria. Por favor, aguarde novas atualizações.`;
    }

    return res.json({
      ok: true,
      item: { id: lastInsertRowid, codigo, estado: estadoInicial },
      feedback
    });
  });

  // Endpoints da Secretaria
  app.get('/api/secretaria/fila', (req: Request, res: Response) => {
    if (req.session.perfil !== 'secretaria') return res.status(403).json({ erro: 'Acesso negado' });
    const fila = query<Item>(
      "SELECT * FROM itens WHERE tipo = 'achado' AND estado = 'pendente_entrega' ORDER BY id ASC"
    );
    res.json(fila);
  });

  app.get('/api/secretaria/custodia', (req: Request, res: Response) => {
    if (req.session.perfil !== 'secretaria') return res.status(403).json({ erro: 'Acesso negado' });

    const achados = query<Item>(
      "SELECT * FROM itens WHERE tipo = 'achado' AND estado = 'em_custodia' ORDER BY id ASC"
    );
    const perdidos = query<Item>(
      "SELECT * FROM itens WHERE tipo = 'perdido' AND estado = 'aguardando_localizacao'"
    );

    const custodia = achados.map(a => {
      const cands = perdidos
        .map(p => ({ ...p, score: similaridade(a, p) }))
        .filter(p => p.score >= 40)
        .sort((c1, c2) => c2.score - c1.score)
        .slice(0, 3);
      return { achado: a, cands };
    });

    res.json(custodia);
  });

  app.get('/api/secretaria/retirada', (req: Request, res: Response) => {
    if (req.session.perfil !== 'secretaria') return res.status(403).json({ erro: 'Acesso negado' });

    const achadosRetirada = query<Item>(
      "SELECT * FROM itens WHERE tipo = 'achado' AND estado = 'disponivel_levantamento' ORDER BY id ASC"
    );

    const retirada = achadosRetirada.map(a => {
      const perdido = a.par_id ? queryOne<Item>("SELECT * FROM itens WHERE id = ?", [a.par_id]) : null;
      const dono = perdido ? queryOne<Usuario>("SELECT nome FROM usuarios WHERE id = ?", [perdido.usuario_id]) : null;

      return {
        id: a.id,
        codigo: a.codigo,
        categoria: a.categoria,
        localizacao: a.localizacao || 'Secretaria Geral',
        cod_perdido: perdido?.codigo || '---',
        dono: dono?.nome || 'Proprietário'
      };
    });

    res.json(retirada);
  });

  app.post('/api/secretaria/receber/:id', (req: Request, res: Response) => {
    if (req.session.perfil !== 'secretaria') return res.status(403).json({ erro: 'Acesso negado' });

    const id = parseInt(req.params.id, 10);
    const loc = (req.body.localizacao || '').trim();

    if (!loc) return res.status(400).json({ erro: 'Localização de guarda obrigatória.' });

    const item = queryOne<Item>(
      "SELECT * FROM itens WHERE id = ? AND tipo = 'achado' AND estado = 'pendente_entrega'",
      [id]
    );

    if (!item) return res.status(404).json({ erro: 'Item não encontrado ou já em custódia.' });

    run("UPDATE itens SET estado = 'em_custodia', localizacao = ? WHERE id = ?", [loc, id]);

    return res.json({
      ok: true,
      mensagem: `Item ${item.codigo} recebido na Secretaria e guardado em: ${loc}`
    });
  });

  // FLUXO 3: Match & Notificação direta obrigatória
  app.post('/api/secretaria/match', (req: Request, res: Response) => {
    if (req.session.perfil !== 'secretaria') return res.status(403).json({ erro: 'Acesso negado' });

    const achadoId = parseInt(req.body.achado, 10);
    const perdidoId = parseInt(req.body.perdido, 10);

    const achado = queryOne<Item>("SELECT * FROM itens WHERE id = ?", [achadoId]);
    const perdido = queryOne<Item>("SELECT * FROM itens WHERE id = ?", [perdidoId]);

    if (!achado || !perdido) {
      return res.status(404).json({ erro: 'Itens não encontrados para correspondência.' });
    }

    // Atualização de status para 'disponivel_levantamento'
    run("UPDATE itens SET estado = 'disponivel_levantamento', par_id = ? WHERE id = ?", [perdidoId, achadoId]);
    run("UPDATE itens SET estado = 'disponivel_levantamento', par_id = ? WHERE id = ?", [achadoId, perdidoId]);

    // Mensagem de notificação obrigatória:
    const mensagemObrigatoria = "O seu objeto/documento deu entrada na Secretaria da Universidade Técnica. Pode dirigir-se ao local para proceder ao levantamento e à verificação de identidade.";

    run(
      "INSERT INTO notificacoes (usuario_id, item_codigo, mensagem) VALUES (?, ?, ?)",
      [perdido.usuario_id, perdido.codigo, mensagemObrigatoria]
    );

    return res.json({
      ok: true,
      mensagem: `Correspondência confirmada entre ${achado.codigo} e ${perdido.codigo}. Notificação enviada ao estudante proprietário.`
    });
  });

  // FLUXO 3b: Devolução e Entrega Formal com Documento
  app.post('/api/secretaria/devolver/:id', (req: Request, res: Response) => {
    if (req.session.perfil !== 'secretaria') return res.status(403).json({ erro: 'Acesso negado' });

    const id = parseInt(req.params.id, 10);
    const doc = (req.body.documento || '').trim();

    if (!doc) return res.status(400).json({ erro: 'O número do BI ou Matrícula é obrigatório.' });

    const achado = queryOne<Item>(
      "SELECT * FROM itens WHERE id = ? AND estado = 'disponivel_levantamento'",
      [id]
    );

    if (!achado || !achado.par_id) {
      return res.status(404).json({ erro: 'Item não encontrado ou sem correspondência.' });
    }

    // Atualiza ambos para 'devolvido'
    run("UPDATE itens SET estado = 'devolvido' WHERE id = ?", [achado.id]);
    run("UPDATE itens SET estado = 'devolvido' WHERE id = ?", [achado.par_id]);

    // Regista a devolução na tabela
    run(
      "INSERT INTO devolucoes (achado_id, perdido_id, documento, secretaria_id) VALUES (?, ?, ?, ?)",
      [achado.id, achado.par_id, doc, req.session.uid]
    );

    return res.json({
      ok: true,
      mensagem: `Devolução do item ${achado.codigo} registada com sucesso (Doc: ${doc}).`
    });
  });

  // Integração do Vite como Middleware em Desenvolvimento
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve('dist'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log(`Localize (React + SQLite) listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar servidor Localize:', err);
});
