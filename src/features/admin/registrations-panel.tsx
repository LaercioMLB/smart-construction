'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminRepository } from '@/infrastructure/admin';
import { AdminError, type AdminSession } from './contracts';
import type { RegistrationFilters, RegistrationPage } from './registration-contracts';

const initial: RegistrationFilters = { page: 1, search: '', tipo: '', status: '' };
export const statusLabels = { pendente: 'Pendente', aprovado: 'Aprovado', reprovado: 'Reprovado' };

export function RegistrationsPanel() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [result, setResult] = useState<RegistrationPage | null>(null);
  const [filters, setFilters] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const failure = useCallback(
    (cause: unknown) => {
      if (cause instanceof AdminError && cause.status === 401) {
        setResult(null);
        setSession(null);
        router.replace('/admin/login');
      } else
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível carregar os cadastros.',
        );
    },
    [router],
  );
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const auth = await adminRepository.session();
        if (cancelled) return;
        setSession(auth);
        const page = await adminRepository.registrations(filters);
        if (!cancelled) setResult(page);
      } catch (cause) {
        if (!cancelled) failure(cause);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [filters, reload, failure]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const tipo = String(data.get('tipo') ?? '');
    const status = String(data.get('status') ?? '');
    setFilters({
      page: 1,
      search: String(data.get('search') ?? ''),
      tipo: tipo === 'empresa' || tipo === 'profissional' ? tipo : '',
      status:
        status === 'pendente' || status === 'aprovado' || status === 'reprovado' ? status : '',
    });
  }
  async function logout() {
    if (!session) return;
    try {
      await adminRepository.logout(session.csrf_token);
      setSession(null);
      setResult(null);
      router.replace('/admin/login');
    } catch (cause) {
      failure(cause);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-500">Cadastros</h1>
          <p className="mt-2 text-gray-600">
            Analise profissionais e empresas. Empresas permanecem privadas.
          </p>
        </div>
        {session && (
          <button className="btn btn-outline" onClick={() => void logout()}>
            Sair
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}{' '}
          <button className="underline" onClick={() => setReload((value) => value + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
      {session && (
        <form onSubmit={filter} className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            Buscar nome ou protocolo
            <input
              className="field mt-1"
              name="search"
              maxLength={120}
              defaultValue={filters.search}
            />
          </label>
          <label>
            Tipo
            <select className="field mt-1" name="tipo" defaultValue={filters.tipo}>
              <option value="">Todos</option>
              <option value="profissional">Profissional</option>
              <option value="empresa">Empresa</option>
            </select>
          </label>
          <label>
            Status
            <select className="field mt-1" name="status" defaultValue={filters.status}>
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary self-end" disabled={loading}>
            Filtrar cadastros
          </button>
        </form>
      )}
      {loading && <p role="status">Carregando cadastros…</p>}
      {result && (
        <>
          <p role="status">{result.meta.total} cadastro(s) encontrado(s).</p>
          {result.data.length === 0 ? (
            <div className="panel p-8 text-gray-600">
              Nenhum cadastro encontrado para os filtros selecionados.
            </div>
          ) : (
            <ul className="space-y-3">
              {result.data.map((row) => (
                <li
                  key={row.id}
                  className="panel flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <h2 className="break-words font-bold text-brand-500">{row.nome_exibicao}</h2>
                    <p className="text-sm text-gray-600">
                      {row.tipo === 'profissional' ? 'Profissional' : 'Empresa'} ·{' '}
                      {statusLabels[row.status]} ·{' '}
                      {new Date(row.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="mt-1 break-all text-xs text-gray-500">
                      Protocolo: {row.protocolo}
                    </p>
                  </div>
                  <Link
                    className="btn btn-outline"
                    href={`/admin/cadastros/${row.id}`}
                    aria-label={`Analisar ${row.nome_exibicao}`}
                  >
                    Analisar
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              className="btn btn-outline"
              disabled={loading || filters.page <= 1}
              onClick={() => setFilters((value) => ({ ...value, page: value.page - 1 }))}
            >
              Anterior
            </button>
            <span className="text-sm">
              Página {filters.page} de {Math.max(1, result.meta.total_pages)}
            </span>
            <button
              className="btn btn-outline"
              disabled={loading || filters.page >= result.meta.total_pages}
              onClick={() => setFilters((value) => ({ ...value, page: value.page + 1 }))}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </div>
  );
}
