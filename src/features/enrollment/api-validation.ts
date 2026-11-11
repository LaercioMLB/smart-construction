import { z } from 'zod';
import { isValidCpf } from '@/shared/masks';

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Informe entre ${min} e ${max} caracteres.`)
    .max(max, `Use até ${max} caracteres.`);
const optional = (max: number) => text(1, max).nullable();
export const states = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export const addressSchema = z.object({
  cidade: text(1, 120),
  uf: z.enum(states),
  cep: z
    .string()
    .regex(/^\d{8}$/, 'Informe os 8 dígitos do CEP.')
    .nullable(),
  rua: optional(200),
  numero: optional(30),
  complemento: optional(150),
  bairro: optional(120),
});
const phone = z.string().regex(/^\+55[1-9][0-9]{9,10}$/, 'Informe um telefone brasileiro com DDD.');
const email = z.email('Confira o e-mail.').max(254).nullable();
const year = z.number().int().min(1900).max(new Date().getFullYear()).nullable();
export function adultBirthCutoff(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const year = value('year') - 18;
  const month = value('month');
  const day = Math.min(value('day'), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export const professionalSchema = z.object({
  nome: text(3, 150),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'Informe os 11 dígitos do CPF.')
    .refine(isValidCpf, 'Confira os dígitos do CPF.'),
  nascimento: z.iso
    .date()
    .refine(
      (value) => value <= new Date().toISOString().slice(0, 10),
      'Nascimento não pode ser futuro.',
    )
    .refine(
      (value) => value <= adultBirthCutoff(),
      'Cadastro permitido somente a maiores de 18 anos.',
    )
    .nullable(),
  whatsapp: phone,
  email,
  endereco: addressSchema,
  biografia: text(20, 400),
  profissoes: z
    .array(
      z.union([
        z.object({ profissao_id: z.uuid(), principal: z.boolean() }),
        z.object({ sugestao: text(2, 100), principal: z.boolean() }),
      ]),
    )
    .min(1)
    .max(5)
    .refine(
      (values) => values.filter((item) => item.principal).length === 1,
      'Escolha uma profissão principal.',
    )
    .refine(
      (values) =>
        new Set(
          values.map((item) =>
            'profissao_id' in item
              ? item.profissao_id
              : item.sugestao
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim()
                  .toLowerCase(),
          ),
        ).size === values.length,
      'Não repita profissões.',
    ),
  cursos: z
    .array(
      z
        .object({ nome: text(1, 150), instituicao: optional(150), inicio: year, conclusao: year })
        .refine(
          (item) =>
            item.inicio === null || item.conclusao === null || item.conclusao >= item.inicio,
          'Conclusão não pode anteceder o início.',
        ),
    )
    .max(10),
});
export const companySchema = z.object({
  razao_social: text(3, 200),
  nome_fantasia: optional(200),
  cnpj: z
    .string()
    .regex(/^[A-Z0-9]{12}[0-9]{2}$/, 'Informe um CNPJ numérico ou alfanumérico válido.'),
  responsavel: text(3, 150),
  whatsapp: phone,
  email,
  segmento: text(1, 150),
  endereco: addressSchema,
  descricao: optional(1000),
});

export function normalizePhone(value: string): string {
  if (!/^[0-9+()\s.\-]+$/.test(value)) return value;
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? `+55${digits}` : `+${digits}`;
}
export function validateFiles(
  profile: File | undefined,
  works: File[],
  logo: File | undefined,
): string | null {
  if (works.length > 6) return 'Envie até seis fotos de trabalhos.';
  if (
    [profile, ...works, logo].some(
      (file) =>
        file &&
        (!['image/jpeg', 'image/png'].includes(file.type) ||
          file.size > 5242880 ||
          file.size === 0),
    )
  )
    return 'Envie imagens JPG/PNG de até 5 MiB por arquivo.';
  return null;
}
