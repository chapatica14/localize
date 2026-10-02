export interface User {
  id: number;
  nome: string;
  email: string;
  perfil: 'estudante' | 'comunidade' | 'secretaria';
}

export type ItemEstado =
  | 'pendente_entrega'
  | 'em_custodia'
  | 'aguardando_localizacao'
  | 'disponivel_levantamento'
  | 'devolvido';

export interface Item {
  id: number;
  codigo: string;
  tipo: 'perdido' | 'achado';
  categoria: string;
  marca?: string;
  cor?: string;
  local_campus: string;
  data_ocorrencia: string;
  estado: ItemEstado;
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

export interface MatchCandidate extends Item {
  score: number;
}

export interface CustodiaGroup {
  achado: Item;
  cands: MatchCandidate[];
}

export interface RetiradaItem {
  id: number;
  codigo: string;
  categoria: string;
  localizacao: string;
  cod_perdido: string;
  dono: string;
}

export const ESTADOS_LABEL: Record<ItemEstado, string> = {
  pendente_entrega: "Pendente de Entrega na Secretaria",
  em_custodia: "Em custódia na Secretaria",
  aguardando_localizacao: "Aguardando Localização / Em Espera",
  disponivel_levantamento: "Disponível para Levantamento",
  devolvido: "Devolvido"
};

export const CATEGORIAS = [
  "Telemóvel",
  "Carteira",
  "Documentos",
  "Chaves",
  "Mochila",
  "Computador",
  "Roupa",
  "Outro"
];

export const LOCAIS = [
  "Biblioteca",
  "Cantina",
  "Bloco A",
  "Bloco B",
  "Laboratório de Informática",
  "Pátio",
  "Outro"
];
