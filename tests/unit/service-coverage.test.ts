import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryNames, productRepository, serviceRepository } from '@/infrastructure/repositories';
import { serviceCoverPath } from '@/shared/assets';

describe('ampliação dos serviços solicitados', () => {
  it.each([
    ['arquiteto', 'arquiteto', 'projeto'],
    ['design de interiores', 'design-de-interiores', 'projeto'],
    ['documentação de obra', 'documentacao-de-obra', 'projeto'],
    ['projeto de gás', 'projeto-de-gas', 'projeto'],
    ['projeto de bombeiro', 'projeto-de-prevencao-contra-incendio', 'projeto'],
    ['projeto elétrico', 'projeto-eletrico', 'projeto'],
    ['laudos técnicos', 'laudos-tecnicos', 'projeto'],
    ['cerca de alambrado', 'cerca-de-alambrado', 'execucao'],
    ['controle de acesso', 'controle-de-acesso', 'execucao'],
    ['cursos', 'cursos', 'execucao'],
    ['fossa mecanizada', 'fossa-mecanizada', 'execucao'],
    ['porcelanato líquido', 'porcelanato-liquido', 'execucao'],
    ['parede cimentícia', 'parede-cimenticia', 'execucao'],
    ['locação de ferramentas', 'locacao-de-ferramentas', 'locacao'],
    ['concreto usinado', 'concreto-usinado', 'material'],
    ['madeireira', 'madeireira', 'material'],
    ['material elétrico', 'material-eletrico', 'material'],
    ['poste de concreto', 'poste-de-concreto', 'material'],
    ['tijolos direto da fábrica', 'tijolos-direto-da-fabrica', 'material'],
    ['artefatos de cimento', 'artefatos-de-cimento', 'material'],
    ['carga de pedrisco', 'cargas-de-areia-pedra-e-pedrisco', 'material'],
    ['pré-moldados', 'pre-moldados', 'material'],
    ['terra para aterro', 'terra-para-aterro', 'material'],
  ])('busca %s expõe %s no trilho %s', async (query, slug, type) => {
    expect((await serviceRepository.search(query)).map((item) => item.slug)).toContain(slug);
    expect(await serviceRepository.get(slug)).toMatchObject({ type });
    const content = await serviceRepository.content(slug);
    expect(content?.sections.hero.title).toBeTruthy();
    // Novas ofertas não herdam garantias, avaliações ou portfólios fictícios.
    expect(content?.sections.hero.features?.map((item) => item.text)).not.toContain(
      'Profissionais certificados',
    );
    expect(content?.sections.professionals).toBeUndefined();
    expect(content?.sections.workGallery).toBeUndefined();
  });

  it('toda oferta tem capa local, relações válidas e um detalhe renderizável', async () => {
    const { data } = await serviceRepository.list({ limit: 500 });
    expect(new Set(data.map((item) => item.slug)).size).toBe(data.length);
    expect(new Set(data.map((item) => item.id)).size).toBe(data.length);
    for (const service of data) {
      expect(fs.existsSync(path.join('public', serviceCoverPath(service.slug)))).toBe(true);
      const page = await serviceRepository.content(service.slug);
      expect(page?.sections.process.steps.length).toBeGreaterThan(0);
      for (const related of page?.sections.related?.services ?? []) {
        expect(related).not.toBe(service.slug);
        expect(await serviceRepository.get(related)).not.toBeNull();
      }
    }
    expect(await serviceRepository.counts()).toEqual({
      execucao: 71,
      locacao: 6,
      projeto: 7,
      material: 9,
    });
  });

  it('os links das novas páginas chegam a produtos reais nas categorias indicadas', async () => {
    const { data } = await serviceRepository.list({ type: 'material', limit: 500 });
    for (const service of data) {
      const page = await serviceRepository.content(service.slug);
      const href = page?.sections.hero.secondaryCta?.link;
      expect(href).toMatch(/^\/catalogo\?/);
      const params = new URL(href ?? '', 'https://local.invalid').searchParams;
      const products = await productRepository.list({
        category: params.getAll('category'),
        limit: 500,
      });
      expect(products.data.length).toBeGreaterThan(0);
      for (const product of products.data) expect(categoryNames[product.category]).toBeTruthy();
    }
  });

  it('os novos materiais não apresentam preço ou avaliação inventados', async () => {
    const { data } = await productRepository.list({ limit: 500 });
    const added = data.filter((item) => item.id > 190);
    // O legado termina no ID 190, apesar de conter 180 produtos.
    expect(added.length).toBe(6);
    for (const item of added) {
      expect(item.price).toBeUndefined();
      expect(item.rating).toBeUndefined();
      expect(item.reviewCount).toBe(0);
      expect(fs.existsSync(path.join('public', item.image))).toBe(true);
    }
    expect((await productRepository.get('concreto-pronto-hipermassa'))?.description).toContain(
      'Mistura seca',
    );
    expect((await productRepository.get('concreto-usinado'))?.description).toContain(
      'concreto usinado',
    );
  });

  it('torna explícitos venda de ar e os equipamentos antes parciais', async () => {
    expect((await serviceRepository.get('ar-condicionado'))?.description).toContain('Venda');
    expect((await serviceRepository.get('locacao-de-equipamentos-pesados'))?.description).toContain(
      'pantaneira',
    );
    expect((await serviceRepository.get('locacao-de-equipamentos-pesados'))?.description).toContain(
      'rolo compactador',
    );
    expect(
      (await serviceRepository.content('cursos'))?.sections.overview?.paragraphs.join(' '),
    ).toContain('precisam ser confirmados');
  });
});
