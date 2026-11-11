import { afterEach, expect, it, vi } from 'vitest';
import { adultBirthCutoff } from '@/features/enrollment/api-validation';
import { legalVersionsMatch } from '@/features/enrollment/legal-configuration';

afterEach(() => vi.useRealTimers());

it('mantém o formulário fechado quando versões da API e textos divergem', () => {
  const versions = { terms: 'termos-v1', privacy: 'privacidade-v1' };
  const config = {
    habilitado: true,
    versao_termos: versions.terms,
    versao_privacidade: versions.privacy,
  };
  expect(legalVersionsMatch(config, versions)).toBe(true);
  expect(legalVersionsMatch({ ...config, habilitado: false }, versions)).toBe(false);
  expect(legalVersionsMatch({ ...config, versao_termos: null }, versions)).toBe(false);
  expect(legalVersionsMatch({ ...config, versao_privacidade: 'anterior' }, versions)).toBe(false);
});

it('confere maioridade na data de São Paulo, inclusive na virada UTC', () => {
  expect(adultBirthCutoff(new Date('2026-10-24T01:00:00Z'))).toBe('2008-10-23');
  expect(adultBirthCutoff(new Date('2026-10-24T04:00:00Z'))).toBe('2008-10-24');
});

it('preserva a fronteira de aniversário em anos bissextos', () => {
  expect(adultBirthCutoff(new Date('2024-02-29T15:00:00Z'))).toBe('2006-02-28');
  expect(adultBirthCutoff(new Date('2026-02-28T15:00:00Z'))).toBe('2008-02-28');
});
