import Fuse from 'fuse.js';
import type { Service } from '@/shared/types/service';

// O placeholder da busca ensina o cliente a escrever frases ("meu cano estourou"), e o Fuse
// pontua a string inteira — frase longa nunca passa do threshold. Por isso a busca é por
// token: normaliza, descarta o que não é vocabulário de serviço e agrega os matches.

// Só palavras de 3+ letras chegam aqui (as menores caem no corte de tamanho).
const STOPWORDS = new Set([
  'meu',
  'meus',
  'minha',
  'minhas',
  'seu',
  'sua',
  'seus',
  'suas',
  'preciso',
  'precisando',
  'quero',
  'queria',
  'gostaria',
  'tenho',
  'estou',
  'para',
  'pra',
  'com',
  'uma',
  'umas',
  'uns',
  'que',
  'por',
  'como',
  'onde',
]);

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const tokenize = (q: string) =>
  normalize(q)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

export function createServiceSearch(services: Service[]) {
  const fuse = new Fuse(services, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'keywords', weight: 0.3 },
      { name: 'aliases', weight: 0.3 },
      { name: 'description', weight: 0.2 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    ignoreDiacritics: true,
    includeScore: true,
  });

  return (query: string): Service[] => {
    const tokens = tokenize(query);

    // Query só com stopwords/palavras curtas ("ar", "tv"): a busca direta ainda acha
    // o serviço ("Ar-Condicionado"); devolver vazio esconderia catálogo existente.
    if (tokens.length === 0) {
      const q = normalize(query);
      return q ? fuse.search(q).map((r) => r.item) : [];
    }

    const hits = new Map<Service['slug'], { item: Service; matched: number; score: number }>();
    for (const token of tokens) {
      for (const r of fuse.search(token)) {
        const hit = hits.get(r.item.slug) ?? { item: r.item, matched: 0, score: 0 };
        hit.matched += 1;
        hit.score += r.score ?? 0;
        hits.set(r.item.slug, hit);
      }
    }

    // As keywords são vocabulário do cliente: quando a consulta (sem stopwords) é uma delas
    // ao pé da letra ("pia entupida"), esse serviço vence o empate contra match fuzzy.
    const phrase = tokens.join(' ');
    const hasPhrase = (s: Service) =>
      [s.name, ...s.keywords, ...(s.aliases ?? [])].some((k) => normalize(k).includes(phrase));

    // Mais tokens casados primeiro, frase literal depois; por fim o score do Fuse
    // (menor = mais perto).
    return [...hits.values()]
      .sort(
        (a, b) =>
          b.matched - a.matched ||
          Number(hasPhrase(b.item)) - Number(hasPhrase(a.item)) ||
          a.score - b.score,
      )
      .map((h) => h.item);
  };
}
