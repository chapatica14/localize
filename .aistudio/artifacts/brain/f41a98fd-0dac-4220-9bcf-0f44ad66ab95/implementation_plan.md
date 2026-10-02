# Transformação do Localize para React e SQLite (Zero-Configuration)

Este plano transforma o Localize numa aplicação com **Frontend moderno em React** e **Base de Dados SQLite persistente (`localize.db`)**, concebido para que você consiga abrir e rodar no seu Windows com apenas `npm.cmd install` e `npm.cmd run dev`, **sem precisar instalar C++, Python ou ferramentas adicionais no sistema**.

---

## 1. Princípio Fundamental: "Funcionar sem Instalar Mais Nada"

No Windows, bibliotecas SQLite com código nativo C++ (como `better-sqlite3` ou `node-gyp`) costumam falhar se o utilizador não tiver o *Visual Studio C++ Build Tools* instalado.
Para garantir que funcione perfeitamente no seu computador:
1. **SQLite sem compilação nativa**:
   - Utilizaremos `sql.js` (SQLite compilado em WebAssembly pelo projeto oficial SQLite) com persistência em ficheiro local `localize.db` ou fallback para o módulo embutido do Node.js.
   - Isso garante 100% de compatibilidade em qualquer versão do Windows, sem necessidade de ferramentas de compilação.
2. **React SPA com Servidor Integrado**:
   - Um único comando (`npm.cmd run dev`) inicia o backend Express e serve o frontend React na porta `3000`.
   - Você abre no navegador (`http://localhost:3000`) e tem a experiência de um aplicativo desktop fluido e reativo.

---

## 2. Nova Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVEGADOR (React SPA)                    │
│  - Painel do Estudante / Comunidade com abas e notificações  │
│  - Painel da Secretaria (Fila de Entrada, Match e Devolução)│
│  - Atualizações instantâneas de estado e toasts sem reload  │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON via REST API (/api/*)
┌──────────────────────────────▼──────────────────────────────┐
│                    BACKEND (Express.js)                     │
│  - Rotas de Autenticação (/api/auth/login, /api/auth/demo)  │
│  - Rotas de Itens (/api/itens - POST / GET)                 │
│  - Rotas da Secretaria (/api/secretaria/receber, match...)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Consultas SQL (SELECT/INSERT)
┌──────────────────────────────▼──────────────────────────────┐
│                  SQLITE (`localize.db`)                     │
│  - Tabela `usuarios`                                        │
│  - Tabela `itens` (status: pendente_entrega, etc.)          │
│  - Tabela `notificacoes`                                    │
│  - Tabela `devolucoes`                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Modelo da Base de Dados SQLite

Ficheiro gerado automaticamente na raiz: `localize.db`

### Tabelas:
1. **`usuarios`**:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `nome TEXT NOT NULL`
   - `email TEXT UNIQUE NOT NULL`
   - `senha_hash TEXT NOT NULL`
   - `perfil TEXT NOT NULL CHECK (perfil IN ('estudante', 'comunidade', 'secretaria'))`
   - `criado_em TEXT DEFAULT CURRENT_TIMESTAMP`

2. **`itens`**:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `codigo TEXT UNIQUE NOT NULL`
   - `tipo TEXT NOT NULL CHECK (tipo IN ('perdido', 'achado'))`
   - `categoria TEXT NOT NULL`
   - `marca TEXT`
   - `cor TEXT`
   - `local_campus TEXT NOT NULL`
   - `data_ocorrencia TEXT NOT NULL`
   - `estado TEXT NOT NULL CHECK (estado IN ('pendente_entrega', 'em_custodia', 'aguardando_localizacao', 'disponivel_levantamento', 'devolvido'))`
   - `localizacao TEXT`
   - `par_id INTEGER REFERENCES itens(id)`
   - `usuario_id INTEGER REFERENCES usuarios(id)`
   - `criado_em TEXT DEFAULT CURRENT_TIMESTAMP`

3. **`notificacoes`**:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `usuario_id INTEGER REFERENCES usuarios(id)`
   - `item_codigo TEXT NOT NULL`
   - `mensagem TEXT NOT NULL`
   - `lida INTEGER DEFAULT 0`
   - `criada_em TEXT DEFAULT CURRENT_TIMESTAMP`

4. **`devolucoes`**:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `achado_id INTEGER REFERENCES itens(id)`
   - `perdido_id INTEGER REFERENCES itens(id)`
   - `documento TEXT NOT NULL`
   - `secretaria_id INTEGER REFERENCES usuarios(id)`
   - `criado_em TEXT DEFAULT CURRENT_TIMESTAMP`

---

## 4. Preservação Rigorosa dos 3 Fluxos de Negócio

1. **Fluxo 1 (Item Encontrado)**:
   - Utilizador regista o achado.
   - Status inicial gravado no SQLite: `"Pendente de Entrega na Secretaria"`.
   - Feedback automático: *"Obrigado pelo registo! Por favor, dirija-se à Secretaria da Universidade Técnica para entregar o objeto/documento e concluir o processo."*
2. **Fluxo 2 (Item Perdido)**:
   - Utilizador regista a notificação de perda.
   - Status inicial gravado no SQLite: `"Aguardando Localização / Em Espera"`.
   - Feedback automático: *"Sua notificação foi registada com sucesso. O seu objeto/documento ainda não deu entrada na Secretaria. Por favor, aguarde novas atualizações."*
3. **Fluxo 3 (Match & Levantamento)**:
   - Secretaria regista a entrada física (`em_custodia`).
   - Algoritmo calcula a afinidade de atributos diretamente via SQL/queries de pontuação.
   - Secretaria confirma o match: status comuta para `"Disponível para Levantamento"` e gera registo na tabela `notificacoes` com o texto exato:
     *"O seu objeto/documento deu entrada na Secretaria da Universidade Técnica. Pode dirigir-se ao local para proceder ao levantamento e à verificação de identidade."*
   - O estudante vê o alerta em tempo real no painel React.
   - Na devolução física com BI/Matrícula, o status comuta para `"Devolvido"`.

---

## 5. Passos de Implementação

1. **Dependências (`package.json`)**:
   - Adicionar `react`, `react-dom`, `@types/react`, `@types/react-dom`.
   - Adicionar biblioteca SQLite pura (`sql.js`) e motor de build/servidor leve.
2. **Módulo de Base de Dados SQLite (`src/db.ts`)**:
   - Inicialização automática da base de dados `localize.db` com criação das tabelas e seeding de utilizadores de teste (`secretaria@campus.local` e `estudante@campus.local`).
3. **API REST no Express (`server.ts`)**:
   - Rotas de login, registo, logout e status de sessão.
   - Endpoints `/api/itens`, `/api/notificacoes`, `/api/secretaria/receber`, `/api/secretaria/match`, `/api/secretaria/devolver`.
4. **Aplicação Frontend React**:
   - Interface com design moderno e limpo do campus universitário.
   - Componentes React:
     - `Header`: Barra superior com identificação do utilizador e botão de troca de conta/sessão.
     - `LoginView`: Acesso rápido com botões de 1 clique para Estudante e Secretaria.
     - `EstudanteDashboard`: Notificações ativas em destaque, formulário de registo dinâmico e tabela com status coloridos.
     - `SecretariaDashboard`: Abas para Fila de Entrada, Cruzamentos de Afinidade (%) e Levantamentos com documento.
5. **Verificação de Build**:
   - Garantir compilação com `compile_applet` e inicialização limpa com `restart_dev_server`.
