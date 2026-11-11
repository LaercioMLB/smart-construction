import type { PageMeta, ProfessionHistory } from './contracts';

export type RegistrationType = 'profissional' | 'empresa';
export type RegistrationStatus = 'pendente' | 'aprovado' | 'reprovado';
export interface Address {
  cidade: string;
  uf: string;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
}
export type ProfessionChoice =
  { profissao_id: string; principal: boolean } | { sugestao: string; principal: boolean };
export interface Course {
  nome: string;
  instituicao: string | null;
  inicio: number | null;
  conclusao: number | null;
}
export interface ProfessionalData {
  nome: string;
  cpf: string;
  nascimento: string | null;
  whatsapp: string;
  email: string | null;
  endereco: Address;
  biografia: string;
  profissoes: ProfessionChoice[];
  cursos: Course[];
}
export interface CompanyData {
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  responsavel: string;
  whatsapp: string;
  email: string | null;
  segmento: string;
  endereco: Address;
  descricao: string | null;
}
export interface RegistrationSummary {
  id: string;
  protocolo: string;
  tipo: RegistrationType;
  nome_exibicao: string;
  status: RegistrationStatus;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}
export interface RegistrationFile {
  id: string;
  finalidade: 'foto_perfil' | 'foto_trabalho' | 'logo';
  content_type: 'image/jpeg' | 'image/png';
  tamanho_bytes: number;
  estado: 'pronto' | 'processando' | 'erro';
  ordem: number;
  criado_em: string;
  acesso_path: string;
}
interface RegistrationBase extends Omit<RegistrationSummary, 'tipo' | 'nome_exibicao'> {
  arquivos: RegistrationFile[];
  motivo_reprovacao: string | null;
  aceites: {
    tipo: 'termos' | 'privacidade' | 'publicacao' | 'maioridade';
    versao: string;
    aceito_em: string;
  }[];
}
export type Registration =
  | (RegistrationBase & {
      tipo: 'profissional';
      profissional_id: string;
      dados: ProfessionalData;
      publicacao: { publicado: boolean; revisao: number; atualizado_em: string | null };
    })
  | (RegistrationBase & { tipo: 'empresa'; empresa_id: string; dados: CompanyData });
export type RegistrationChanges =
  | { tipo: 'profissional'; alteracoes: ProfessionalData }
  | { tipo: 'empresa'; alteracoes: CompanyData };
export interface RegistrationPage {
  data: RegistrationSummary[];
  meta: PageMeta;
}
export interface RegistrationFilters {
  page: number;
  search: string;
  tipo: RegistrationType | '';
  status: RegistrationStatus | '';
}
export interface RegistrationHistory {
  data: (Omit<ProfessionHistory['data'][number], 'administrador'> & {
    administrador: ProfessionHistory['data'][number]['administrador'] | null;
  })[];
  meta: PageMeta;
}
export type RegistrationAction = 'aprovar' | 'reprovar' | 'reabrir' | 'publicar' | 'despublicar';
export interface RegistrationRepository {
  uploadRegistrationFile(
    record: Registration,
    file: File,
    purpose: RegistrationFile['finalidade'],
    csrf: string,
  ): Promise<void>;
  removeRegistrationFile(record: Registration, file: RegistrationFile, csrf: string): Promise<void>;
  registrations(filters: RegistrationFilters): Promise<RegistrationPage>;
  registration(id: string): Promise<Registration>;
  registrationHistory(id: string, page: number): Promise<RegistrationHistory>;
  updateRegistration(
    record: Registration,
    changes: RegistrationChanges,
    csrf: string,
  ): Promise<Registration>;
  decideRegistration(
    record: Registration,
    action: RegistrationAction,
    csrf: string,
    reason?: string,
  ): Promise<Registration>;
}
