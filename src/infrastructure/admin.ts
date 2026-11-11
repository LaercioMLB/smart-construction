import type { AdminRepository } from '@/features/admin/contracts';
import { httpAdminRepository } from './http/admin-repository';

export const adminRepository: AdminRepository = httpAdminRepository;
