'use client';
import { useState } from 'react';
import { enrollmentRepository, companySchema, type CompanyInput, type Receipt } from './repository';
import { Field } from './field';
import { ButtonLink } from '@/shared/components/ui';
export function CompanyForm() {
  const [input, setInput] = useState<CompanyInput>({
    razaoSocial: '',
    nomeEmpresa: '',
    documento: '',
    segmento: '',
    cidade: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  async function submit() {
    if (pending) return;
    const result = companySchema.safeParse(input);
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    setPending(true);
    try {
      setReceipt(await enrollmentRepository.submitCompany(input));
    } catch {
      setErrors({ submit: 'Não foi possível registrar. Tente novamente.' });
    } finally {
      setPending(false);
    }
  }
  return receipt ? (
    <div className="panel text-center">
      <h2 className="mb-4 text-2xl font-bold text-brand-500">Cadastro simulado com sucesso!</h2>
      <p className="mb-3">
        {receipt.name} — {receipt.id}
      </p>
      <p className="mb-6 text-sm text-gray-500">
        Nenhum dado foi enviado. Registro local: {receipt.status}.
      </p>
      <ButtonLink href="/">Voltar para a Home</ButtonLink>
    </div>
  ) : (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="panel space-y-5 p-6 sm:p-8"
    >
      <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-500">
        Demonstração local. Use somente dados fictícios. Nenhum cadastro é enviado.
      </p>
      {errors.submit && (
        <p role="alert" className="text-red-600">
          {errors.submit}
        </p>
      )}
      {(
        [
          ['razaoSocial', 'Razão Social'],
          ['nomeEmpresa', 'Nome Da Empresa'],
          ['documento', 'CNPJ ou CPF'],
          ['segmento', 'Segmento da Empresa'],
          ['cidade', 'Cidade'],
        ] as const
      ).map(([key, label]) => (
        <Field
          key={key}
          name={key}
          label={label}
          value={input[key]}
          onChange={(value) => setInput((old) => ({ ...old, [key]: value }))}
          error={errors[key]}
        />
      ))}
      <div className="flex flex-wrap justify-between gap-3 pt-3">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setInput({ razaoSocial: '', nomeEmpresa: '', documento: '', segmento: '', cidade: '' });
            setErrors({});
          }}
        >
          Limpar formulário
        </button>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Registrando…' : 'Enviar cadastro'}
        </button>
      </div>
    </form>
  );
}
