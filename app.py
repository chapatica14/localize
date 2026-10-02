import os
from datetime import date
from functools import wraps

import sqlite3
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash

# A base de dados é o ficheiro localize.db, criado automaticamente ao lado do app.py
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "localize.db")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "mude-esta-chave")

CATEGORIAS = ["Telemóvel", "Carteira", "Documentos", "Chaves", "Mochila", "Computador", "Roupa", "Outro"]
LOCAIS = ["Biblioteca", "Cantina", "Bloco A", "Bloco B", "Laboratório de Informática", "Pátio", "Outro"]
ESTADOS = {"pendente": "Pendente", "triagem": "Em triagem", "espera": "Aguardando retirada", "concluido": "Concluído"}


SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('estudante','comunidade','secretaria')),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('perdido','achado')),
  categoria TEXT NOT NULL,
  marca TEXT,
  cor TEXT,
  local_campus TEXT NOT NULL,
  data_ocorrencia TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','triagem','espera','concluido')),
  localizacao TEXT,
  par_id INTEGER,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS devolucoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  achado_id INTEGER NOT NULL REFERENCES itens(id),
  perdido_id INTEGER NOT NULL REFERENCES itens(id),
  documento TEXT NOT NULL,
  secretaria_id INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


def q(sql, args=(), one=False, write=False):
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        cur = con.execute(sql, args)
        if write:
            con.commit()
            return cur.lastrowid
        if one:
            r = cur.fetchone()
            return dict(r) if r else None
        return [dict(r) for r in cur.fetchall()]
    finally:
        con.close()


with sqlite3.connect(DB) as _con:
    _con.executescript(SCHEMA)


def exige(*perfis):
    def deco(f):
        @wraps(f)
        def w(*a, **k):
            if session.get("perfil") not in perfis:
                return redirect(url_for("login"))
            return f(*a, **k)
        return w
    return deco


def norm(t):
    return (t or "").strip().lower()


def similaridade(a, b):
    """Blind matching: categoria 40, marca 25, cor 20, local 15."""
    s = 0
    if a["categoria"] == b["categoria"]:
        s += 40
    if norm(a["marca"]) and norm(a["marca"]) == norm(b["marca"]):
        s += 25
    if norm(a["cor"]) and norm(a["cor"]) == norm(b["cor"]):
        s += 20
    if a["local_campus"] == b["local_campus"]:
        s += 15
    return s


@app.context_processor
def globais():
    return dict(CATEGORIAS=CATEGORIAS, LOCAIS=LOCAIS, ESTADOS=ESTADOS, hoje=date.today().isoformat())


# ---------- Autenticação ----------
@app.get("/")
def inicio():
    p = session.get("perfil")
    if p == "secretaria":
        return redirect(url_for("secretaria"))
    return redirect(url_for("painel" if p else "login"))


@app.route("/registo", methods=["GET", "POST"])
def registo():
    if request.method == "POST":
        f = request.form
        if f.get("perfil") not in ("estudante", "comunidade") or len(f.get("senha", "")) < 6:
            flash("Escolha um perfil e use uma senha com 6 ou mais caracteres.", "erro")
        else:
            try:
                q("INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)",
                  (f["nome"].strip(), f["email"].strip().lower(), generate_password_hash(f["senha"]), f["perfil"]),
                  write=True)
                flash("Conta criada. Já pode entrar.", "ok")
                return redirect(url_for("login"))
            except sqlite3.IntegrityError:
                flash("Este email já tem conta.", "erro")
    return render_template("registo.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = q("SELECT * FROM usuarios WHERE email=?", (request.form["email"].strip().lower(),), one=True)
        if u and check_password_hash(u["senha_hash"], request.form["senha"]):
            session.clear()
            session.update(uid=u["id"], nome=u["nome"], perfil=u["perfil"])
            return redirect(url_for("inicio"))
        flash("Email ou senha incorretos.", "erro")
    return render_template("login.html")


@app.get("/sair")
def sair():
    session.clear()
    return redirect(url_for("login"))


# ---------- Estudante / Comunidade ----------
@app.get("/painel")
@exige("estudante", "comunidade")
def painel():
    itens = q("SELECT * FROM itens WHERE usuario_id=? ORDER BY id DESC", (session["uid"],))
    return render_template("painel.html", itens=itens)


@app.post("/item")
@exige("estudante", "comunidade")
def novo_item():
    f = request.form
    tipo = f.get("tipo")
    if tipo not in ("perdido", "achado") or (tipo == "perdido" and session["perfil"] != "estudante"):
        flash("Tipo de registo inválido.", "erro")
        return redirect(url_for("painel"))
    novo_id = q("""INSERT INTO itens (tipo, categoria, marca, cor, local_campus, data_ocorrencia, usuario_id)
                   VALUES (?,?,?,?,?,?,?)""",
                (tipo, f["categoria"], f.get("marca", "").strip(), f.get("cor", "").strip(),
                 f["local"], f["data"], session["uid"]), write=True)
    codigo = f"LOC-{novo_id:04d}"
    q("UPDATE itens SET codigo=? WHERE id=?", (codigo, novo_id), write=True)
    flash(f"Registado com o código {codigo}." + (" Entregue o item na Secretaria." if tipo == "achado" else ""), "ok")
    return redirect(url_for("painel"))


# ---------- Secretaria ----------
@app.get("/secretaria")
@exige("secretaria")
def secretaria():
    fila = q("SELECT * FROM itens WHERE tipo='achado' AND estado='pendente' ORDER BY id")
    perdidos = q("SELECT * FROM itens WHERE tipo='perdido' AND estado='pendente'")
    custodia = []
    for a in q("SELECT * FROM itens WHERE tipo='achado' AND estado='triagem' ORDER BY id"):
        cands = sorted(({**p, "score": similaridade(a, p)} for p in perdidos), key=lambda x: -x["score"])
        custodia.append((a, [c for c in cands if c["score"] >= 40][:3]))
    retirada = q("""SELECT a.id, a.codigo, a.categoria, a.localizacao, p.codigo AS cod_perdido, u.nome AS dono
                    FROM itens a JOIN itens p ON p.id=a.par_id JOIN usuarios u ON u.id=p.usuario_id
                    WHERE a.tipo='achado' AND a.estado='espera'""")
    return render_template("secretaria.html", fila=fila, custodia=custodia, retirada=retirada)


@app.post("/secretaria/receber/<int:id>")
@exige("secretaria")
def receber(id):
    loc = request.form["localizacao"].strip()
    if loc:
        q("UPDATE itens SET estado='triagem', localizacao=? WHERE id=? AND tipo='achado' AND estado='pendente'",
          (loc, id), write=True)
        flash("Item recebido e guardado.", "ok")
    return redirect(url_for("secretaria"))


@app.post("/secretaria/match")
@exige("secretaria")
def match():
    a, p = int(request.form["achado"]), int(request.form["perdido"])
    q("UPDATE itens SET estado='espera', par_id=? WHERE id=?", (p, a), write=True)
    q("UPDATE itens SET estado='espera', par_id=? WHERE id=?", (a, p), write=True)
    flash("Correspondência confirmada. O proprietário já pode levantar o item.", "ok")
    return redirect(url_for("secretaria"))


@app.post("/secretaria/devolver/<int:id>")
@exige("secretaria")
def devolver(id):
    a = q("SELECT * FROM itens WHERE id=? AND estado='espera'", (id,), one=True)
    doc = request.form["documento"].strip()
    if a and doc:
        q("UPDATE itens SET estado='concluido' WHERE id IN (?,?)", (a["id"], a["par_id"]), write=True)
        q("INSERT INTO devolucoes (achado_id, perdido_id, documento, secretaria_id) VALUES (?,?,?,?)",
          (a["id"], a["par_id"], doc, session["uid"]), write=True)
        flash("Devolução registada.", "ok")
    return redirect(url_for("secretaria"))


if __name__ == "__main__":
    app.run(debug=True)
