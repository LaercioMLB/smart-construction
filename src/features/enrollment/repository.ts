import { z } from 'zod';
import { demoConfig } from '@/infrastructure/config';
import { getProfessionalSchemas } from './schemas';
export const draftSchema = z.object({
  personal: z.object({
    nome: z.string(),
    cpf: z.string(),
    data_de_nascimento: z.string(),
    telefone: z.string(),
    email: z.string(),
  }),
  address: z.object({
    cep: z.string(),
    rua: z.string(),
    numero: z.string(),
    complemento: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    estado: z.string(),
  }),
  categories: z.array(
    z.object({
      id_profissao: z.number().optional(),
      texto: z.string().optional(),
      nome_profissao: z.string(),
      principal: z.boolean(),
    }),
  ),
  bio: z.string(),
  courses: z.array(
    z.object({
      nome: z.string(),
      instituicao: z.string(),
      inicio: z.string(),
      conclusao: z.string(),
    }),
  ),
  step: z.number().int().min(1).max(5),
  completed: z.array(z.number().int().min(1).max(4)),
});
export type ProfessionalDraft = z.infer<typeof draftSchema>;
export type SelectedCategory = ProfessionalDraft['categories'][number];
export const emptyDraft = (): ProfessionalDraft => ({
  personal: { nome: '', cpf: '', data_de_nascimento: '', telefone: '', email: '' },
  address: { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
  categories: [],
  bio: '',
  courses: [],
  step: 1,
  completed: [],
});
export interface LocalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const fallbackData = new Map<string, string>();
const fallbackStore: LocalStore = {
  getItem: (key) => fallbackData.get(key) ?? null,
  setItem: (key, value) => {
    fallbackData.set(key, value);
  },
  removeItem: (key) => {
    fallbackData.delete(key);
  },
};
function browserStore(): LocalStore {
  try {
    if (typeof window !== 'undefined') return window.localStorage;
  } catch {}
  return fallbackStore;
}
const receiptSchema = z.object({
  id: z.string(),
  name: z.string(),
  categories: z.array(z.string()),
  status: z.literal('em análise — demonstração'),
});
export type Receipt = z.infer<typeof receiptSchema>;
export const companySchema = z.object({
  razaoSocial: z.string().trim().min(1, 'Informe a razão social'),
  nomeEmpresa: z.string().trim().min(1, 'Informe o nome da empresa'),
  documento: z.string().trim().min(1, 'Informe o CNPJ ou CPF'),
  segmento: z.string().trim().min(1, 'Informe o segmento da empresa'),
  cidade: z.string().trim().min(1, 'Informe a cidade'),
});
export type CompanyInput = z.infer<typeof companySchema>;
export interface EnrollmentRepository {
  loadDraft(): Promise<ProfessionalDraft | null>;
  saveDraft(draft: ProfessionalDraft): Promise<boolean>;
  discardDraft(): Promise<void>;
  submit(draft: ProfessionalDraft, acceptedTerms: boolean, files: File[]): Promise<Receipt>;
  submitCompany(input: CompanyInput): Promise<Receipt>;
  receipt(): Promise<Receipt | null>;
  lookupCep(cep: string): Promise<ProfessionalDraft['address'] | null>;
}
export function validateStep(draft: ProfessionalDraft, step: number): Record<string, string> {
  const s = getProfessionalSchemas();
  const result =
    step === 1
      ? s.personalSchema.safeParse(draft.personal)
      : step === 2
        ? s.addressSchema.safeParse(draft.address)
        : step === 3
          ? s.profileCategoriesSchema.safeParse({ categorias: draft.categories })
          : s.workProfileSchema.safeParse({
              bio: draft.bio,
              cursos: draft.courses.filter((c) => Object.values(c).some((value) => value.trim())),
            });
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
}
export function validateFiles(files: Pick<File, 'type' | 'size'>[], max: number): string | null {
  if (files.length > max) return `Você pode enviar no máximo ${max} fotos.`;
  if (files.some((file) => !['image/jpeg', 'image/png'].includes(file.type)))
    return 'Os arquivos precisam ser imagens JPG ou PNG.';
  if (files.some((file) => file.size > 5 * 1024 * 1024))
    return 'Cada imagem deve ter no máximo 5 MB.';
  return null;
}
export function createEnrollmentRepository(
  store: () => LocalStore = browserStore,
): EnrollmentRepository {
  const draftKey = 'smart-demo:professional-draft:v1';
  const receiptKey = 'smart-demo:receipt:v1';
  function read(key: string): unknown {
    try {
      const raw = store().getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function saveReceipt(name: string, categories: string[]): Receipt {
    const old = receiptSchema.safeParse(read(receiptKey));
    const sequence = old.success ? Number(old.data.id.split('-').at(-1)) + 1 : 1;
    const receipt: Receipt = {
      id: `CAD-DEMO-${String(sequence).padStart(4, '0')}`,
      name,
      categories,
      status: 'em análise — demonstração',
    };
    store().setItem(receiptKey, JSON.stringify(receipt));
    return receipt;
  }
  return {
    async loadDraft() {
      const result = draftSchema.safeParse(read(draftKey));
      return result.success ? result.data : null;
    },
    async saveDraft(draft) {
      try {
        store().setItem(draftKey, JSON.stringify(draftSchema.parse(draft)));
        return true;
      } catch {
        return false;
      }
    },
    async discardDraft() {
      store().removeItem(draftKey);
    },
    async submit(draft, acceptedTerms, files) {
      await demoConfig.beforeOperation();
      for (let step = 1; step <= 4; step++) {
        const errors = validateStep(draft, step);
        if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
      }
      if (!acceptedTerms) throw new Error('Aceite os Termos de Uso e a Política de Privacidade.');
      const error = validateFiles(files, 7);
      if (error) throw new Error(error);
      const receipt = saveReceipt(
        draft.personal.nome,
        draft.categories.map((c) => c.nome_profissao),
      );
      store().removeItem(draftKey);
      return receipt;
    },
    async submitCompany(input) {
      await demoConfig.beforeOperation();
      const value = companySchema.parse(input);
      return saveReceipt(value.nomeEmpresa, [value.segmento]);
    },
    async receipt() {
      const result = receiptSchema.safeParse(read(receiptKey));
      return result.success ? result.data : null;
    },
    async lookupCep(cep) {
      await demoConfig.beforeOperation();
      if (cep.replace(/\D/g, '') === '85854000')
        return {
          cep: '85854-000',
          rua: 'Rua de Demonstração',
          numero: '',
          complemento: '',
          bairro: 'Bairro Exemplo',
          cidade: 'Foz do Iguaçu',
          estado: 'PR',
        };
      return null;
    },
  };
}
export const enrollmentRepository: EnrollmentRepository = createEnrollmentRepository();
