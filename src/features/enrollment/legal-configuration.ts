import type { EnrollmentConfiguration } from './contracts';

export function legalVersionsMatch(
  configuration: EnrollmentConfiguration,
  versions: { terms: string; privacy: string },
): boolean {
  return (
    configuration.habilitado &&
    configuration.versao_termos === versions.terms &&
    configuration.versao_privacidade === versions.privacy
  );
}
