import type { RegistrationRepository } from './registration-contracts';

export interface AdminSession {
  administrador: { id: string; nome: string; login: string };
  expira_em: string;
  csrf_token: string;
}

export interface Profession {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  versao: number;
  criado_em: string;
  atualizado_em: string;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ProfessionPage {
  data: Profession[];
  meta: PageMeta;
}

export interface ProfessionHistory {
  data: {
    id: string;
    acao: string;
    administrador: { id: string; nome: string; login: string };
    ocorrido_em: string;
    motivo: string | null;
    alteracoes: { campo: string; valor_anterior: string | null; valor_atual: string | null }[];
  }[];
  meta: PageMeta;
}

export interface ProfessionFilters {
  page: number;
  search: string;
  active: '' | 'true' | 'false';
}

export interface ProfessionChanges {
  nome?: string;
  ativo?: boolean;
}

export interface AdminRepository extends RegistrationRepository {
  session(): Promise<AdminSession>;
  login(login: string, password: string): Promise<AdminSession>;
  logout(csrf: string): Promise<void>;
  professions(filters: ProfessionFilters): Promise<ProfessionPage>;
  createProfession(name: string, active: boolean, csrf: string): Promise<Profession>;
  updateProfession(
    profession: Profession,
    changes: ProfessionChanges,
    csrf: string,
  ): Promise<Profession>;
  professionHistory(id: string, page: number): Promise<ProfessionHistory>;
}

export class AdminError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}
