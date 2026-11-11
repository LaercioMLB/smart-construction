// Identificadores públicos de rotas, usados apenas para preservar deep links.
// A entidade e os dados exibidos continuam inteiramente sintéticos.
export const legacyProfessionalRoutes: Readonly<Record<string, string>> = {
  'roberto-silva': '1',
  'gabriel-almeida': '2',
  'carlos-mendes': '3',
  'joao-ferreira': '4',
  'marcos-oliveira': '5',
  'ana-costa': '6',
  'pedro-souza': '7',
  'lucia-ramos': '8',
  'thiago-barbosa': '9',
  'fernando-lima': '10',
  'paulo-xavier': '11',
  'rafael-nunes': '12',
};
export const professionalId = (id: string) => legacyProfessionalRoutes[id] ?? id;
