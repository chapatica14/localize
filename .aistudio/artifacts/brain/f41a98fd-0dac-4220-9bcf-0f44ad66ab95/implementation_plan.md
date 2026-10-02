# Implementação dos 3 Fluxos Obrigatórios do Localize

Alinha a aplicação às 3 regras de negócio essenciais: registo de itens encontrados, notificação de perdas e cruzamento (match) com avisos automáticos e atualização de status até a devolução final na Secretaria da Universidade Técnica.

## Decisões Críticas e Requisitos Confirmados

> [!IMPORTANT]
> As mensagens de feedback do sistema e os rótulos de status seguem estritamente as especificações exigidas pelo utilizador.

- **Fluxo 1 (Item Encontrado)**:
  - Feedback imediato: *"Obrigado pelo registo! Por favor, dirija-se à Secretaria da Universidade Técnica para entregar o objeto/documento e concluir o processo."*
  - Status inicial: **"Pendente de Entrega na Secretaria"**.
- **Fluxo 2 (Item Perdido)**:
  - Feedback imediato: *"Sua notificação foi registada com sucesso. O seu objeto/documento ainda não deu entrada na Secretaria. Por favor, aguarde novas atualizações."*
  - Status inicial: **"Aguardando Localização / Em Espera"**.
- **Fluxo 3 (Match & Levantamento)**:
  - Notificação ao proprietário: *"O seu objeto/documento deu entrada na Secretaria da Universidade Técnica. Pode dirigir-se ao local para proceder ao levantamento e à verificação de identidade."*
  - Status em caso de correspondência: **"Disponível para Levantamento"**.
  - Status após devolução formal com documento: **"Devolvido"**.

---

## 1. Visão Geral e Conceito

O sistema estabelece uma ponte fluida e rastreável entre quem encontra algo no campus da Universidade Técnica, quem perdeu, e os funcionários da Secretaria responsáveis pela guarda física e devolução formal.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CICLO DE VIDA DOS ITENS                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
[Achado por alguém]                                            [Perdido por alguém]
Status: "Pendente de Entrega na Secretaria"                    Status: "Aguardando Localização / Em Espera"
Mensagem: Dirija-se à Secretaria para entregar                 Mensagem: Notificação registada, aguarde
    │                                                               │
    ▼                                                               │
(Entrega física na Secretaria - Armário/Prateleira)                │
    │                                                               │
    └───────────────────────► [ MATCH ] ◄───────────────────────────┘
                                    │
                                    ▼
                Status: "Disponível para Levantamento"
                Notificação automática gerada para o proprietário
                                    │
                                    ▼
            (Apresentação de BI/Matrícula na Secretaria)
                                    │
                                    ▼
                        Status final: "Devolvido"
```

---

## 2. Experiência do Utilizador e Interface

### 2.1 Visão do Estudante / Comunidade (`/painel`)
1. **Registo de Item Encontrado (`tipo: achado`)**:
   - O utilizador submete categoria, marca/modelo, cor, local aproximado e data.
   - Mensagem em destaque no topo: *"Obrigado pelo registo! Por favor, dirija-se à Secretaria da Universidade Técnica para entregar o objeto/documento e concluir o processo."*
   - O item surge na tabela com o código único (ex.: `LOC-0003`) e badge de status **"Pendente de Entrega na Secretaria"**.

2. **Registo de Item Perdido (`tipo: perdido`)**:
   - O utilizador submete a descrição do pertence perdido.
   - Mensagem em destaque: *"Sua notificação foi registada com sucesso. O seu objeto/documento ainda não deu entrada na Secretaria. Por favor, aguarde novas atualizações."*
   - O item surge com o badge **"Aguardando Localização / Em Espera"**.

3. **Painel de Notificações Ativas**:
   - Um cartão de alertas no topo do painel exibe mensagens recebidas da Secretaria.
   - Quando houver match, surge o aviso formal:
     > 📢 **Aviso de Levantamento:** O seu objeto/documento deu entrada na Secretaria da Universidade Técnica. Pode dirigir-se ao local para proceder ao levantamento e à verificação de identidade.
   - Na tabela de registos, a linha do item exibe a badge verde **"Disponível para Levantamento"** com instrução para comparecer à Secretaria munido de documento de identificação.

### 2.2 Visão da Secretaria (`/secretaria`)
1. **Fila de Entrada (Pendente de Entrega)**:
   - Lista os itens achados que aguardam entrega física por quem os encontrou.
   - Permite à Secretaria dar entrada ("Receber") e definir a localização do depósito físico (ex.: *Armário B - Gaveta 3*).
2. **Correspondências e Cruzamento de Dados (Match)**:
   - Apresenta as correspondências calculadas pelo algoritmo com score percentual de similaridade (categoria, marca, cor, local).
   - Ao clicar em **"Confirmar Correspondência"**:
     - O sistema cruza os IDs do achado e do pedido de perda.
     - Dispara automaticamente a notificação para a conta do estudante dono do item perdido.
     - Atualiza o status de ambos para **"Disponível para Levantamento"**.
3. **Aguardando Retirada & Registo de Devolução**:
   - Lista todos os itens disponíveis para entrega.
   - Exibe o código do item, localização no depósito, código do perdido e nome do dono.
   - A Secretaria recolhe o número do BI ou matrícula do estudante e clica em **"Registar devolução"**.
   - O status é comutado para **"Devolvido"** e arquivado no histórico de devoluções.

---

## 3. Arquitetura Técnica e Mapeamento de Estados

### Novo Mapeamento de Estados:
```typescript
const ESTADOS: Record<string, string> = {
  pendente_entrega: "Pendente de Entrega na Secretaria",
  em_custodia: "Em custódia na Secretaria",
  aguardando_localizacao: "Aguardando Localização / Em Espera",
  disponivel_levantamento: "Disponível para Levantamento",
  devolvido: "Devolvido"
};
```

### Entidade de Notificações:
```typescript
interface Notificacao {
  id: number;
  usuario_id: number;
  item_codigo: string;
  mensagem: string;
  lida: boolean;
  criada_em: string;
}
```

### Arquivos Modificados:
1. `server.ts`:
   - Atualização do dicionário `ESTADOS` e mapeamentos de estado inicial por tipo de registo (`achado` -> `pendente_entrega`, `perdido` -> `aguardando_localizacao`).
   - Adaptação das mensagens flash de resposta com os textos literais exigidos.
   - Geração de notificação no array de `notificacoes` quando a Secretaria efetua o `POST /secretaria/match`.
   - Atualização de status no match para `disponivel_levantamento` e na devolução para `devolvido`.
   - Passagem das notificações ativas do utilizador autenticado para os templates EJS.
2. `views/painel.ejs`:
   - Seção de alertas de notificações recebidas para itens encontrados.
   - Atualização visual das badges de status e orientações contextuais.
3. `views/secretaria.ejs`:
   - Atualização dos filtros de listagem para refletir a nova nomenclatura de status.
   - Preservação da experiência com os novos status no fluxo de devolução.
4. `static/css/style.css`:
   - Estilos dedicados para as novas classes de badge (`badge--pendente_entrega`, `badge--aguardando_localizacao`, `badge--disponivel_levantamento`, `badge--devolvido`).
