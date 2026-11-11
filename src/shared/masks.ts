// Máscaras de UI para o cadastro de prestador.
// Regra: a máscara existe SÓ na camada visual. O payload sempre usa dígitos
// crus (ver `onlyDigits`). Cada `mask*` recebe um valor parcial e devolve a
// string formatada para exibir no input enquanto o usuário digita.

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** CPF → `000.000.000-00` (até 11 dígitos). */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** CEP → `00000-000` (até 8 dígitos). */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

/** Telefone BR → `(00) 0000-0000` ou `(00) 00000-0000` (10–11 dígitos). */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^\((\d{2})\) (\d{4})(\d)/, '($1) $2-$3');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/^\((\d{2})\) (\d{5})(\d)/, '($1) $2-$3');
}

/** Data → `dd/mm/aaaa` (até 8 dígitos). */
export function maskDate(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/^(\d{2})(\d)/, '$1/$2').replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

/** `dd/mm/aaaa` → `aaaa-mm-dd` (ISO). Retorna '' se incompleta. */
export function brDateToISO(value: string): string {
  const d = onlyDigits(value);
  if (d.length !== 8) return '';
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

/** Valida se `dd/mm/aaaa` é uma data real (dia/mês existentes, ano plausível). */
export function isValidBrDate(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 8) return false;
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Idade (em anos) a partir de `dd/mm/aaaa`, ou `null` se inválida. */
export function getAgeFromBrDate(value: string): number | null {
  if (!isValidBrDate(value)) return null;
  const d = onlyDigits(value);
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return age;
}

/** Valida CPF pelos dígitos verificadores (recebe dígitos crus ou mascarado). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (000.000.000-00, etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcCheckDigit = (slice: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (factorStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheckDigit(cpf.slice(0, 9), 10);
  if (d1 !== Number(cpf[9])) return false;

  const d2 = calcCheckDigit(cpf.slice(0, 10), 11);
  return d2 === Number(cpf[10]);
}
