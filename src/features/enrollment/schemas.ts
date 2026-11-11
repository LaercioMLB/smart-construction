import { z } from 'zod';
import { onlyDigits, isValidCpf, isValidBrDate, getAgeFromBrDate } from '@/shared/masks';

// Schemas Zod por passo do wizard. Cada `UForm` valida só o passo atual.
// Os campos guardam o valor de UI (mascarado); a validação trabalha sobre os
// dígitos crus. A conversão final para o payload acontece no `useProfessionalSubmit`.

// Fonte de verdade das UFs: nome por extenso (exibido) + sigla (valor enviado,
// CHAR(2) no EnderecoDTO). As siglas (`UFS`) são derivadas daqui.
export const UF_OPTIONS = [
  { label: 'Acre', value: 'AC' },
  { label: 'Alagoas', value: 'AL' },
  { label: 'Amapá', value: 'AP' },
  { label: 'Amazonas', value: 'AM' },
  { label: 'Bahia', value: 'BA' },
  { label: 'Ceará', value: 'CE' },
  { label: 'Distrito Federal', value: 'DF' },
  { label: 'Espírito Santo', value: 'ES' },
  { label: 'Goiás', value: 'GO' },
  { label: 'Maranhão', value: 'MA' },
  { label: 'Mato Grosso', value: 'MT' },
  { label: 'Mato Grosso do Sul', value: 'MS' },
  { label: 'Minas Gerais', value: 'MG' },
  { label: 'Pará', value: 'PA' },
  { label: 'Paraíba', value: 'PB' },
  { label: 'Paraná', value: 'PR' },
  { label: 'Pernambuco', value: 'PE' },
  { label: 'Piauí', value: 'PI' },
  { label: 'Rio de Janeiro', value: 'RJ' },
  { label: 'Rio Grande do Norte', value: 'RN' },
  { label: 'Rio Grande do Sul', value: 'RS' },
  { label: 'Rondônia', value: 'RO' },
  { label: 'Roraima', value: 'RR' },
  { label: 'Santa Catarina', value: 'SC' },
  { label: 'São Paulo', value: 'SP' },
  { label: 'Sergipe', value: 'SE' },
  { label: 'Tocantins', value: 'TO' },
] as const;

export const UFS = UF_OPTIONS.map((uf) => uf.value);

export function getProfessionalSchemas() {
  const personalSchema = z.object({
    nome: z
      .string()
      .trim()
      .min(3, 'Informe seu nome completo')
      .refine((v) => v.trim().split(/\s+/).length >= 2, 'Informe nome e sobrenome'),
    cpf: z
      .string()
      .refine((v) => onlyDigits(v).length === 11, 'CPF deve ter 11 dígitos')
      .refine((v) => isValidCpf(v), 'CPF inválido'),
    data_de_nascimento: z
      .string()
      .min(1, 'Informe sua data de nascimento')
      .refine((v) => onlyDigits(v).length === 8, 'Use o formato dd/mm/aaaa')
      .refine((v) => isValidBrDate(v), 'Data inválida')
      .refine((v) => (getAgeFromBrDate(v) ?? 0) >= 18, 'É necessário ter pelo menos 18 anos'),
    telefone: z.string().refine((v) => {
      const d = onlyDigits(v).length;
      return d >= 10 && d <= 11;
    }, 'Telefone/WhatsApp inválido'),
    email: z.string().trim().email('E-mail inválido').optional().or(z.literal('')),
  });

  const addressSchema = z.object({
    cep: z.string().refine((v) => onlyDigits(v).length === 8, 'CEP deve ter 8 dígitos'),
    rua: z.string().trim().min(1, 'Informe a rua'),
    numero: z.string().trim().optional().or(z.literal('')),
    complemento: z.string().trim().optional().or(z.literal('')),
    bairro: z.string().trim().min(1, 'Informe o bairro'),
    cidade: z.string().trim().min(1, 'Informe a cidade'),
    estado: z
      .string()
      .min(1, 'Selecione o estado')
      .refine((v) => (UFS as readonly string[]).includes(v), 'Estado inválido'),
  });

  // Híbrido (Apêndice C): cada item tem `id_profissao` (da lista) OU `texto` (livre).
  const categoriaSchema = z
    .object({
      id_profissao: z.number().optional(),
      texto: z.string().trim().min(1).optional(),
      principal: z.boolean(),
    })
    .refine((c) => c.id_profissao != null || (c.texto?.length ?? 0) > 0, {
      message: 'Categoria inválida',
    });

  const profileCategoriesSchema = z.object({
    categorias: z
      .array(categoriaSchema)
      .min(1, 'Selecione pelo menos uma categoria')
      .max(5, 'Você pode escolher no máximo 5 profissões')
      .refine(
        (cats) => cats.filter((c) => c.principal).length === 1,
        'Escolha exatamente uma categoria principal',
      ),
  });

  // Etapa "Sobre o trabalho": bio obrigatória; cursos opcionais (cada linha com
  // `nome`). O portfólio (File[]) é validado na UI (tipo/tamanho/quantidade).
  // Ano opcional: vazio é aceito; se preenchido, precisa ser 4 dígitos (sem letras).
  const anoCurso = z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Use um ano com 4 dígitos (ex.: 2020)')
    .or(z.literal(''));

  const cursoSchema = z.object({
    nome: z.string().trim().min(1, 'Informe o nome do curso'),
    instituicao: z.string().trim().optional().or(z.literal('')),
    inicio: anoCurso,
    conclusao: anoCurso,
  });

  const workProfileSchema = z.object({
    bio: z
      .string()
      .trim()
      .min(20, 'Conte um pouco sobre seu trabalho (mín. 20 caracteres)')
      .max(400, 'Máximo de 400 caracteres'),
    cursos: z.array(cursoSchema).max(10, 'Você pode adicionar no máximo 10 cursos'),
  });

  return { personalSchema, addressSchema, profileCategoriesSchema, workProfileSchema };
}

export type PersonalSchema = z.output<ReturnType<typeof getProfessionalSchemas>['personalSchema']>;
export type AddressSchema = z.output<ReturnType<typeof getProfessionalSchemas>['addressSchema']>;
