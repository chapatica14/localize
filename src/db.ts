import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: 'estudante' | 'comunidade' | 'secretaria';
  criado_em: string;
}

export interface Item {
  id: number;
  codigo: string;
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

export interface Notificacao {
  id: number;
  usuario_id: number;
  item_codigo: string;
  mensagem: string;
  lida: number;
  criada_em: string;
}

export interface Devolucao {
  id: number;
  achado_id: number;
  perdido_id: number;
  documento: string;
  secretaria_id: number;
  criado_em: string;
}

const dbFilePath = path.resolve('localize.db');
let db: Database | null = null;

export function persistDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(dbFilePath)) {
    const filebuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK (perfil IN ('estudante', 'comunidade', 'secretaria')),
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('perdido', 'achado')),
      categoria TEXT NOT NULL,
      marca TEXT,
      cor TEXT,
      local_campus TEXT NOT NULL,
      data_ocorrencia TEXT NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('pendente_entrega', 'em_custodia', 'aguardando_localizacao', 'disponivel_levantamento', 'devolvido')),
      localizacao TEXT,
      par_id INTEGER,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notificacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      item_codigo TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      lida INTEGER DEFAULT 0,
      criada_em TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devolucoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achado_id INTEGER NOT NULL REFERENCES itens(id),
      perdido_id INTEGER NOT NULL REFERENCES itens(id),
      documento TEXT NOT NULL,
      secretaria_id INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default test accounts if empty
  const userCountRes = db.exec("SELECT COUNT(*) AS total FROM usuarios");
  const userCount = (userCountRes[0]?.values[0]?.[0] as number) || 0;

  if (userCount === 0) {
    const hashSec = bcrypt.hashSync('secretaria123', 10);
    const hashEst = bcrypt.hashSync('estudante123', 10);

    db.run(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
      ['Secretaria Geral', 'secretaria@campus.local', hashSec, 'secretaria']
    );
    db.run(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
      ['João Estudante', 'estudante@campus.local', hashEst, 'estudante']
    );

    const hoje = new Date().toISOString().split('T')[0];

    db.run(
      `INSERT INTO itens (codigo, tipo, categoria, marca, cor, local_campus, data_ocorrencia, estado, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['LOC-0001', 'perdido', 'Mochila', 'Eastpak', 'Preto', 'Biblioteca', hoje, 'aguardando_localizacao', 2]
    );

    db.run(
      `INSERT INTO itens (codigo, tipo, categoria, marca, cor, local_campus, data_ocorrencia, estado, localizacao, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['LOC-0002', 'achado', 'Mochila', 'Eastpak', 'Preto', 'Biblioteca', hoje, 'em_custodia', 'Armário A - Prateleira 1', 1]
    );
  }

  persistDb();
  return db;
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error("Base de dados SQLite não inicializada");
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  if (!db) throw new Error("Base de dados SQLite não inicializada");
  db.run(sql, params);
  const idRes = db.exec("SELECT last_insert_rowid() AS id");
  const lastId = (idRes[0]?.values[0]?.[0] as number) || 0;
  persistDb();
  return { lastInsertRowid: lastId, changes: 1 };
}
