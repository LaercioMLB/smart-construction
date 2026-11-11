import { afterEach, describe, expect, it } from 'vitest';
import {
  createEnrollmentRepository,
  emptyDraft,
  validateStep,
  validateFiles,
  type LocalStore,
} from '@/features/enrollment/repository';
import { isValidCpf, isValidBrDate, maskCpf, maskPhone } from '@/shared/masks';
import { demoConfig } from '@/infrastructure/config';
function repository() {
  const map = new Map<string, string>();
  const store: LocalStore = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  return { repo: createEnrollmentRepository(() => store), map };
}
const valid = () => ({
  ...emptyDraft(),
  personal: {
    nome: 'Pessoa Exemplo',
    cpf: '529.982.247-25',
    data_de_nascimento: '01/01/1990',
    telefone: '(45) 90000-0000',
    email: 'pessoa@example.invalid',
  },
  address: {
    cep: '85854-000',
    rua: 'Rua Exemplo',
    numero: '10',
    complemento: '',
    bairro: 'Bairro Exemplo',
    cidade: 'Foz do Iguaçu',
    estado: 'PR',
  },
  categories: [{ texto: 'Pintor', nome_profissao: 'Pintor', principal: true }],
  bio: 'Profissional fictício de pintura e acabamento para demonstração.',
});
afterEach(() => demoConfig.configure({}));
describe('validações reais do formulário legado', () => {
  it('CPF rejeita repetição e dígito incorreto; máscaras parciais funcionam', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
    expect(maskPhone('45900000000')).toBe('(45) 90000-0000');
    expect(isValidBrDate('31/02/1990')).toBe(false);
  });
  it('impede dados inválidos, menoridade, ausência de principal e bio curta', () => {
    const draft = valid();
    expect(validateStep(draft, 1)).toEqual({});
    draft.personal.nome = 'Ana';
    draft.personal.data_de_nascimento = '01/01/2020';
    expect(validateStep(draft, 1)).toHaveProperty('nome');
    expect(validateStep(draft, 1)).toHaveProperty('data_de_nascimento');
    draft.categories[0].principal = false;
    expect(validateStep(draft, 3)).toHaveProperty('categorias');
    draft.bio = 'curta';
    expect(validateStep(draft, 4)).toHaveProperty('bio');
  });
  it('fotos respeitam tipo, tamanho e quantidade', () => {
    expect(validateFiles([{ type: 'text/plain', size: 1 }], 6)).toContain('JPG');
    expect(validateFiles([{ type: 'image/png', size: 6 * 1024 * 1024 }], 6)).toContain('5 MB');
    expect(
      validateFiles(
        Array.from({ length: 7 }, () => ({ type: 'image/png', size: 1 })),
        6,
      ),
    ).toContain('6 fotos');
  });
  it('curso incompleto é erro e curso vazio é opcional', () => {
    const draft = valid();
    draft.courses = [{ nome: '', instituicao: '', inicio: '', conclusao: '' }];
    expect(validateStep(draft, 4)).toEqual({});
    draft.courses[0].inicio = '202X';
    expect(validateStep(draft, 4)).toHaveProperty('cursos.0.inicio');
    expect(validateStep(draft, 4)).toHaveProperty('cursos.0.nome');
  });
});
describe('persistência local e envio simulado', () => {
  it('recupera e descarta rascunho; rejeita storage corrompido', async () => {
    const { repo, map } = repository();
    expect(await repo.loadDraft()).toBeNull();
    const draft = valid();
    draft.step = 3;
    await repo.saveDraft(draft);
    expect((await repo.loadDraft())?.step).toBe(3);
    map.set('smart-demo:professional-draft:v1', '{"personal":null}');
    expect(await repo.loadDraft()).toBeNull();
    await repo.saveDraft(draft);
    await repo.discardDraft();
    expect(await repo.loadDraft()).toBeNull();
  });
  it('sem aceite não envia; sucesso limpa draft e pode ser relido', async () => {
    const { repo } = repository();
    const draft = valid();
    await repo.saveDraft(draft);
    await expect(repo.submit(draft, false, [])).rejects.toThrow('Aceite');
    expect(await repo.receipt()).toBeNull();
    const receipt = await repo.submit(draft, true, []);
    expect(receipt.id).toBe('CAD-DEMO-0001');
    expect(await repo.loadDraft()).toBeNull();
    expect(await repo.receipt()).toEqual(receipt);
    expect(JSON.stringify(receipt)).not.toContain(draft.personal.cpf);
  });
  it('erro controlado permite repetir sem perder rascunho', async () => {
    const { repo } = repository();
    const draft = valid();
    await repo.saveDraft(draft);
    demoConfig.configure({ failures: 1 });
    await expect(repo.submit(draft, true, [])).rejects.toThrow();
    expect(await repo.loadDraft()).not.toBeNull();
    await expect(repo.submit(draft, true, [])).resolves.toHaveProperty('id', 'CAD-DEMO-0001');
  });
  it('CEP conhecido preenche dados fictícios e desconhecido permite manual', async () => {
    const { repo } = repository();
    expect((await repo.lookupCep('85854-000'))?.cidade).toBe('Foz do Iguaçu');
    expect(await repo.lookupCep('00000-000')).toBeNull();
  });
  it('cadastro empresa exige os cinco campos observados e gera recibo', async () => {
    const { repo } = repository();
    await expect(
      repo.submitCompany({
        razaoSocial: '',
        nomeEmpresa: '',
        documento: '',
        segmento: '',
        cidade: '',
      }),
    ).rejects.toThrow();
    await expect(
      repo.submitCompany({
        razaoSocial: 'Empresa Exemplo LTDA',
        nomeEmpresa: 'Empresa Exemplo',
        documento: '00.000.000/0000-00',
        segmento: 'Materiais',
        cidade: 'Foz do Iguaçu',
      }),
    ).resolves.toHaveProperty('name', 'Empresa Exemplo');
  });
});
