// A Smart Construction intermedia os quatro tipos; não executa nenhum. O que muda é o que o cliente leva:
// execução entrega um resultado (terreno nivelado), locação entrega tempo de uso (a caçamba
// fica 7 dias na obra). Serviço novo se classifica por aí.
export type ServiceType = 'execucao' | 'locacao' | 'material' | 'projeto';

export interface Category {
  name: string;
  slug: string;
  examples?: string; // subtítulo leigo no chip (ex.: "Vazamento, cano, caixa d'água")
  icon?: string;
}
export interface Service {
  id: number | string;
  name: string;
  slug: string;
  type: ServiceType;
  category: string;
  size?: 'medium' | 'large' | string;
  icon: string;
  description: string;
  keywords: string[];
  aliases?: string[]; // sinônimos canônicos p/ a busca (ex.: "bombeiro hidráulico")
  popularity: number;
}
