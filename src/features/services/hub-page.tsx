import type { ServiceType } from '@/shared/types/service';
import { serviceRepository } from '@/infrastructure/repositories';
import { ServiceHub } from './service-hub';
export async function HubPage({ type }: { type: ServiceType }) {
  const [initial, categories, counts] = await Promise.all([
    serviceRepository.list({ type, limit: 9 }),
    serviceRepository.categories(),
    serviceRepository.counts(),
  ]);
  return <ServiceHub type={type} initial={initial} categories={categories} counts={counts} />;
}
