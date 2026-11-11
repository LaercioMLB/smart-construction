import type { CompanyData, ProfessionalData } from '@/features/admin/registration-contracts';

export interface EnrollmentConfiguration {
  habilitado: boolean;
  versao_termos: string | null;
  versao_privacidade: string | null;
}
export interface Receipt {
  protocolo: string;
  status: 'pendente';
  recebido_em: string;
}
export interface ProfessionOption {
  id: string;
  nome: string;
  slug: string;
}
export type EnrollmentInput =
  | { tipo: 'profissional'; dados: ProfessionalData; foto_perfil?: File; fotos_trabalhos: File[] }
  | { tipo: 'empresa'; dados: CompanyData; logo?: File };
export interface EnrollmentRepository {
  configuration(): Promise<EnrollmentConfiguration>;
  professions(): Promise<ProfessionOption[]>;
  submit(kind: 'profissional' | 'empresa', body: FormData, key: string): Promise<Receipt>;
}
