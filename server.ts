import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare module 'express-session' {
  interface SessionData {
    uid?: number;
    nome?: string;
    perfil?: 'estudante' | 'comunidade' | 'secretaria';
    token?: string;
  }
}

interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: 'estudante' | 'comunidade' | 'secretaria';
  criado_em: string;
}

interface Item {
  id: number;
  codigo?: string;
  tipo: 'perdido' | 'achado';
  categoria: string;
  marca?: string;
  cor?: string;
  local_campus: string;
  data_ocorrencia: string;
  estado: 'pendente_entrega' | 'em_custodia' | 'aguardando_localizacao' | 'disponivel_levantamento' | 'devolvido';
  localizacao?: string;
  par_id?: number;
  usuario_id: number;
  criado_em: string;
}

interface Devolucao {
  id: number;
  achado_id: number;
  perdido_id: number;
  documento: string;
  secretaria_id: number;
  criado_em: string;
}

interface Notificacao {
  id: number;
  usuario_id: number;
  item_codigo: string;
  mensagem: string;
  criada_em: string;
}

const CATEGORIAS = ["Telemóvel", "Carteira", "Documentos", "Chaves", "Mochila", "Computador", "Roupa", "Outro"];
const LOCAIS = ["Biblioteca", "Cantina", "Bloco A", "Bloco B", "Laboratório de Informática", "Pátio", "Outro"];

const ESTADOS: Record<string, string> = {
  pendente_entrega: "Pendente de Entrega na Secretaria",
  em_custodia: "Em custódia na Secretaria",
  aguardando_localizacao: "Aguardando Localização / Em Espera",
  disponivel_levantamento: "Disponível para Levantamento",
  devolvido: "Devolvido"
};

// In-Memory Database store
let userSeq = 1;
let itemSeq = 1;
let devSeq = 1;
let notifSeq = 1;

const usuarios: Usuario[] = [];
const itens: Item[] = [];
const devolucoes: Devolucao[] = [];
const notificacoes: Notificacao[] = [];

// Seed default users for quick testing
const defaultPasswordHash = bcrypt.hashSync('secretaria123', 10);
usuarios.push({
  id: userSeq++,
  nome: 'Secretaria Geral',
  email: 'secretaria@campus.local',
  senha_hash: defaultPasswordHash,
  perfil: 'secretaria',
  criado_em: new Date().toISOString()
});

const studentPasswordHash = bcrypt.hashSync('estudante123', 10);
usuarios.push({
  id: userSeq++,
  nome: 'João Estudante',
  email: 'estudante@campus.local',
  senha_hash: studentPasswordHash,
  perfil: 'estudante',
  criado_em: new Date().toISOString()
});

// Seed sample items demonstrating the workflow
const item1: Item = {
  id: itemSeq++,
  codigo: 'LOC-0001',
  tipo: 'perdido',
  categoria: 'Mochila',
  marca: 'Eastpak',
  cor: 'Preto',
  local_campus: 'Biblioteca',
  data_ocorrencia: new Date().toISOString().split('T')[0],
  estado: 'aguardando_localizacao',
  usuario_id: 2,
  criado_em: new Date().toISOString()
};
const item2: Item = {
  id: itemSeq++,
  codigo: 'LOC-0002',
  tipo: 'achado',
  categoria: 'Mochila',
  marca: 'Eastpak',
  cor: 'Preto',
  local_campus: 'Biblioteca',
  data_ocorrencia: new Date().toISOString().split('T')[0],
  estado: 'em_custodia',
  localizacao: 'Armário A - Prateleira 1',
  usuario_id: 1,
  criado_em: new Date().toISOString()
};
itens.push(item1, item2);

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
  if (a.categoria === b.categoria) {
    s += 40;
  }
  if (norm(a.marca) && norm(a.marca) === norm(b.marca)) {
    s += 25;
  }
  if (norm(a.cor) && norm(a.cor) === norm(b.cor)) {
    s += 20;
  }
  if (a.local_campus === b.local_campus) {
    s += 15;
  }
  return s;
}

const app = express();

// Trust reverse proxy for Google Cloud Run HTTPS headers
app.set('trust proxy', 1);

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Cross-origin iframe compatible session
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

app.use(flash());

// Serve static assets
app.use('/static', express.static(path.join(__dirname, 'static')));

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

// Global template variables & flash notifications
app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.session = req.session;
  res.locals.token = req.session.token || (req.query.token as string) || '';
  res.locals.CATEGORIAS = CATEGORIAS;
  res.locals.LOCAIS = LOCAIS;
  res.locals.ESTADOS = ESTADOS;
  res.locals.hoje = new Date().toISOString().split('T')[0];

  const flashes: { category: string; message: string }[] = [];
  const erros = (req.flash('erro') as string[]) || [];
  erros.forEach(m => flashes.push({ category: 'erro', message: m }));
  const oks = (req.flash('ok') as string[]) || [];
  oks.forEach(m => flashes.push({ category: 'ok', message: m }));
  res.locals.flashes = flashes;
  next();
});

// Helper for appending token to redirect URLs
function withToken(urlPath: string, token?: string): string {
  if (!token) return urlPath;
  const separator = urlPath.includes('?') ? '&' : '?';
  return `${urlPath}${separator}token=${encodeURIComponent(token)}`;
}

// Authorization decorator helper
function exige(...perfis: ('estudante' | 'comunidade' | 'secretaria')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.perfil || !perfis.includes(req.session.perfil)) {
      return res.redirect('/login');
    }
    next();
  };
}

// ---------- Autenticação ----------
app.get('/', (req: Request, res: Response) => {
  const p = req.session.perfil;
  const token = req.session.token || (req.query.token as string);
  if (p === 'secretaria') {
    return res.redirect(withToken('/secretaria', token));
  }
  if (p) {
    return res.redirect(withToken('/painel', token));
  }
  return res.redirect('/login');
});

app.get('/registo', (_req: Request, res: Response) => {
  res.render('registo');
});

app.post('/registo', (req: Request, res: Response) => {
  const { nome, email, senha, perfil } = req.body;
  const perfilStr = (perfil || '').trim() as 'estudante' | 'comunidade';
  const senhaStr = (senha || '');
  const emailNorm = (email || '').trim().toLowerCase();
  const nomeStr = (nome || '').trim();

  if (perfilStr !== 'estudante' && perfilStr !== 'comunidade' || senhaStr.length < 6) {
    req.flash('erro', 'Escolha um perfil e use uma senha com 6 ou mais caracteres.');
    return res.redirect('/registo');
  }

  const existing = usuarios.find(u => u.email === emailNorm);
  if (existing) {
    req.flash('erro', 'Este email já tem conta.');
    return res.redirect('/registo');
  }

  const hash = bcrypt.hashSync(senhaStr, 10);
  const novo: Usuario = {
    id: userSeq++,
    nome: nomeStr,
    email: emailNorm,
    senha_hash: hash,
    perfil: perfilStr,
    criado_em: new Date().toISOString()
  };
  usuarios.push(novo);

  // Auto-login newly registered user
  const token = generateToken();
  tokenStore.set(token, { uid: novo.id, nome: novo.nome, perfil: novo.perfil });

  req.session.uid = novo.id;
  req.session.nome = novo.nome;
  req.session.perfil = novo.perfil;
  req.session.token = token;

  req.flash('ok', `Bem-vindo(a), ${novo.nome}! Conta criada com sucesso.`);

  req.session.save((err) => {
    if (err) console.error('Error saving session on register:', err);
    return res.redirect(withToken('/painel', token));
  });
});

app.get('/login', (_req: Request, res: Response) => {
  res.render('login');
});

app.post('/login', (req: Request, res: Response) => {
  const emailNorm = (req.body.email || '').trim().toLowerCase();
  const senhaStr = req.body.senha || '';

  const user = usuarios.find(u => u.email === emailNorm);
  if (user && bcrypt.compareSync(senhaStr, user.senha_hash)) {
    const token = generateToken();
    tokenStore.set(token, { uid: user.id, nome: user.nome, perfil: user.perfil });

    req.session.uid = user.id;
    req.session.nome = user.nome;
    req.session.perfil = user.perfil;
    req.session.token = token;

    req.session.save((err) => {
      if (err) console.error('Error saving session on login:', err);
      const dest = user.perfil === 'secretaria' ? '/secretaria' : '/painel';
      return res.redirect(withToken(dest, token));
    });
    return;
  }

  req.flash('erro', 'Email ou senha incorretos.');
  return res.redirect('/login');
});

// Quick 1-click login for testing
app.post('/login/demo', (req: Request, res: Response) => {
  const perfil = req.body.perfil === 'secretaria' ? 'secretaria' : 'estudante';
  const user = usuarios.find(u => u.perfil === perfil);

  if (user) {
    const token = generateToken();
    tokenStore.set(token, { uid: user.id, nome: user.nome, perfil: user.perfil });

    req.session.uid = user.id;
    req.session.nome = user.nome;
    req.session.perfil = user.perfil;
    req.session.token = token;

    req.flash('ok', `Sessão iniciada como ${user.nome} (${user.perfil}).`);

    req.session.save((err) => {
      if (err) console.error('Error saving session on demo login:', err);
      const dest = perfil === 'secretaria' ? '/secretaria' : '/painel';
      return res.redirect(withToken(dest, token));
    });
    return;
  }

  res.redirect('/login');
});

app.get('/sair', (req: Request, res: Response) => {
  const token = req.session.token;
  if (token) {
    tokenStore.delete(token);
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ---------- Estudante / Comunidade ----------
app.get('/painel', exige('estudante', 'comunidade'), (req: Request, res: Response) => {
  const userItens = itens
    .filter(i => i.usuario_id === req.session.uid)
    .sort((a, b) => b.id - a.id);

  const userNotificacoes = notificacoes
    .filter(n => n.usuario_id === req.session.uid)
    .sort((a, b) => b.id - a.id);

  res.render('painel', { itens: userItens, notificacoes: userNotificacoes });
});

// FLUXO 1 & FLUXO 2: Registo de Item (Achado ou Perdido)
app.post('/item', exige('estudante', 'comunidade'), (req: Request, res: Response) => {
  const { tipo, categoria, marca, cor, local, data } = req.body;
  const perfil = req.session.perfil;
  const token = req.session.token;

  if ((tipo !== 'perdido' && tipo !== 'achado') || (tipo === 'perdido' && perfil !== 'estudante')) {
    req.flash('erro', 'Tipo de registo inválido.');
    return res.redirect(withToken('/painel', token));
  }

  const id = itemSeq++;
  const codigo = `LOC-${String(id).padStart(4, '0')}`;

  // Definir status inicial conforme regra do fluxo
  const estadoInicial = tipo === 'achado' ? 'pendente_entrega' : 'aguardando_localizacao';

  const novoItem: Item = {
    id,
    codigo,
    tipo,
    categoria,
    marca: (marca || '').trim(),
    cor: (cor || '').trim(),
    local_campus: local,
    data_ocorrencia: data,
    estado: estadoInicial,
    usuario_id: req.session.uid!,
    criado_em: new Date().toISOString()
  };
  itens.push(novoItem);

  // Mensagens automáticas de orientação obrigatórias:
  if (tipo === 'achado') {
    // 1. Fluxo de quem encontrou um objeto/documento
    req.flash('ok', `[${codigo}] Obrigado pelo registo! Por favor, dirija-se à Secretaria da Universidade Técnica para entregar o objeto/documento e concluir o processo.`);
  } else {
    // 2. Fluxo de quem perdeu um objeto/documento
    req.flash('ok', `[${codigo}] Sua notificação foi registada com sucesso. O seu objeto/documento ainda não deu entrada na Secretaria. Por favor, aguarde novas atualizações.`);
  }

  return res.redirect(withToken('/painel', token));
});

// ---------- Secretaria ----------
app.get('/secretaria', exige('secretaria'), (_req: Request, res: Response) => {
  // Itens encontrados à espera de entrega física na Secretaria
  const fila = itens
    .filter(i => i.tipo === 'achado' && i.estado === 'pendente_entrega')
    .sort((a, b) => a.id - b.id);

  // Itens perdidos aguardando localização
  const perdidos = itens.filter(i => i.tipo === 'perdido' && i.estado === 'aguardando_localizacao');

  // Itens achados que já deram entrada física e estão em custódia/triagem
  const achadosEmCustodia = itens
    .filter(i => i.tipo === 'achado' && i.estado === 'em_custodia')
    .sort((a, b) => a.id - b.id);

  // Cruzamento de dados (Match) com score de similaridade
  const custodia = achadosEmCustodia.map(a => {
    const cands = perdidos
      .map(p => ({ ...p, score: similaridade(a, p) }))
      .filter(p => p.score >= 40)
      .sort((c1, c2) => c2.score - c1.score)
      .slice(0, 3);
    return { achado: a, cands };
  });

  // Itens com match confirmado disponíveis para levantamento
  const achadosRetirada = itens.filter(i => i.tipo === 'achado' && i.estado === 'disponivel_levantamento');
  const retirada = achadosRetirada.map(a => {
    const perdido = itens.find(p => p.id === a.par_id);
    const donoUser = perdido ? usuarios.find(u => u.id === perdido.usuario_id) : null;
    return {
      id: a.id,
      codigo: a.codigo,
      categoria: a.categoria,
      localizacao: a.localizacao || 'Secretaria Geral',
      cod_perdido: perdido?.codigo || '---',
      dono: donoUser?.nome || 'Desconhecido'
    };
  });

  res.render('secretaria', { fila, custodia, retirada });
});

// Secretaria dá entrada física no item achado
app.post('/secretaria/receber/:id', exige('secretaria'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const loc = (req.body.localizacao || '').trim();
  const token = req.session.token;

  if (loc) {
    const item = itens.find(i => i.id === id && i.tipo === 'achado' && i.estado === 'pendente_entrega');
    if (item) {
      item.estado = 'em_custodia';
      item.localizacao = loc;
      req.flash('ok', `Item ${item.codigo} recebido na Secretaria e guardado em: ${loc}`);
    }
  }

  return res.redirect(withToken('/secretaria', token));
});

// FLUXO 3: Confirmação de Correspondência (Match) e Notificação Automática
app.post('/secretaria/match', exige('secretaria'), (req: Request, res: Response) => {
  const achadoId = parseInt(req.body.achado, 10);
  const perdidoId = parseInt(req.body.perdido, 10);
  const token = req.session.token;

  const achado = itens.find(i => i.id === achadoId);
  const perdido = itens.find(i => i.id === perdidoId);

  if (achado && perdido) {
    // Atualização de status para 'disponivel_levantamento'
    achado.estado = 'disponivel_levantamento';
    achado.par_id = perdidoId;
    perdido.estado = 'disponivel_levantamento';
    perdido.par_id = achadoId;

    // Disparo da notificação direta obrigatória ao proprietário
    const mensagemObrigatoria = "O seu objeto/documento deu entrada na Secretaria da Universidade Técnica. Pode dirigir-se ao local para proceder ao levantamento e à verificação de identidade.";
    
    notificacoes.push({
      id: notifSeq++,
      usuario_id: perdido.usuario_id,
      item_codigo: perdido.codigo || `LOC-${perdido.id}`,
      mensagem: mensagemObrigatoria,
      criada_em: new Date().toISOString()
    });

    req.flash('ok', `Correspondência confirmada entre ${achado.codigo} e ${perdido.codigo}. Notificação enviada ao estudante proprietário.`);
  }

  return res.redirect(withToken('/secretaria', token));
});

// FLUXO 3b: Levantamento Concluído (Devolução)
app.post('/secretaria/devolver/:id', exige('secretaria'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const doc = (req.body.documento || '').trim();
  const token = req.session.token;

  const achado = itens.find(i => i.id === id && i.estado === 'disponivel_levantamento');
  if (achado && doc && achado.par_id) {
    const perdido = itens.find(i => i.id === achado.par_id);
    achado.estado = 'devolvido';
    if (perdido) {
      perdido.estado = 'devolvido';
    }

    devolucoes.push({
      id: devSeq++,
      achado_id: achado.id,
      perdido_id: achado.par_id,
      documento: doc,
      secretaria_id: req.session.uid!,
      criado_em: new Date().toISOString()
    });

    req.flash('ok', `Devolução do item ${achado.codigo} registada com sucesso (Doc: ${doc}).`);
  }

  return res.redirect(withToken('/secretaria', token));
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Localize server listening on http://${HOST}:${PORT}`);
});
