import { createPublicProfessionalRepository } from './http/public-professionals';
import { createEnrollmentRepository, enrollmentBody } from './http/enrollment-repository';
export { PublicApiError } from './http/public-client';
export const publicProfessionalRepository = createPublicProfessionalRepository('/api/v1');
export const enrollmentApi = createEnrollmentRepository('/api/v1');
export const prepareEnrollment = enrollmentBody;
