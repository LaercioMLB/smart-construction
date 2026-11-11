'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { adminRepository } from '@/infrastructure/admin';
import {
  AdminError,
  type AdminSession,
  type Profession,
  type ProfessionFilters,
  type ProfessionPage,
  type ProfessionHistory,
} from './contracts';

const initialFilters: ProfessionFilters = { page: 1, search: '', active: '' };
const historyLabels: Record<string, string> = {
  nome: 'Nome',
  ativo: 'Situação',
  slug: 'Identificador',
  versao: 'Versão',
};

function historyValue(field: string, value: string | null) {
  if (value === null) return '—';
  if (field === 'ativo') return value === 'True' ? 'Ativa' : 'Inativa';
  return value;
}

export function ProfessionsPanel() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [page, setPage] = useState<ProfessionPage | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [editing, setEditing] = useState<Profession | null>(null);
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<{
    profession: Profession;
    result: ProfessionHistory;
  } | null>(null);

  const failure = useCallback(
    (cause: unknown) => {
      if (cause instanceof AdminError && cause.status === 401) {
        setSession(null);
        setPage(null);
        router.replace('/admin/login');
      } else
        setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.');
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const authenticated = await adminRepository.session();
        if (cancelled) return;
        setSession(authenticated);
        const result = await adminRepository.professions(filters);
        if (!cancelled) setPage(result);
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

  function resetEditor() {
    setEditing(null);
    setName('');
    setActive(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editing)
        await adminRepository.updateProfession(
          editing,
          { nome: name.trim(), ativo: active },
          session.csrf_token,
        );
      else await adminRepository.createProfession(name.trim(), active, session.csrf_token);
      setNotice(editing ? 'Profissão atualizada.' : 'Profissão criada.');
      resetEditor();
      setReload((value) => value + 1);
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(record: Profession) {
    if (!session || busy) return;
    if (!window.confirm(`${record.ativo ? 'Desativar' : 'Reativar'} a profissão “${record.nome}”?`))
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminRepository.updateProfession(record, { ativo: !record.ativo }, session.csrf_token);
      if (editing?.id === record.id) resetEditor();
      setNotice(record.ativo ? 'Profissão desativada.' : 'Profissão reativada.');
      setReload((value) => value + 1);
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await adminRepository.logout(session.csrf_token);
      setSession(null);
      setPage(null);
      router.replace('/admin/login');
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }

  async function showHistory(record: Profession, historyPage = 1) {
    setBusy(true);
    setError('');
    try {
      const result = await adminRepository.professionHistory(record.id, historyPage);
      setHistory({ profession: record, result });
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const status = values.get('ativo');
    setFilters({
      page: 1,
      search: String(values.get('search') ?? '').trim(),
      active: status === 'true' || status === 'false' ? status : '',
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker">Administração</p>
          <h1 className="title-section mb-0">Profissões</h1>
          {session && <p className="mt-2">Olá, {session.administrador.nome}.</p>}
        </div>
        {session && (
          <button
            type="button"
            className="btn btn-outline compact"
            disabled={busy}
            onClick={() => void logout()}
          >
            Sair
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 underline"
            disabled={busy || loading}
            onClick={() => {
              resetEditor();
              setReload((value) => value + 1);
            }}
          >
            Recarregar lista
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">
          {notice}
        </p>
      )}
      {loading && <p role="status">Carregando profissões…</p>}
      {session && (
        <>
          <form onSubmit={save} className="panel space-y-4" aria-busy={busy}>
            <h2 className="text-xl font-bold text-brand-500">
              {editing ? 'Editar profissão' : 'Nova profissão'}
            </h2>
            <p className="text-sm">
              Profissões ativas estarão disponíveis para seleção nos cadastros.
            </p>
            <label className="block font-medium">
              Nome da profissão
              <input
                className="field mt-2 w-full"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={100}
                required
                disabled={busy || loading}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                disabled={busy || loading}
              />
              Ativa
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="btn compact" disabled={busy || loading}>
                {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar profissão'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="btn btn-outline compact"
                  onClick={resetEditor}
                  disabled={busy}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
          {history && (
            <section className="panel space-y-4" aria-label="Histórico da profissão">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-bold text-brand-500">
                  Histórico de {history.profession.nome}
                </h2>
                <button type="button" className="underline" onClick={() => setHistory(null)}>
                  Fechar histórico
                </button>
              </div>
              <ol className="space-y-4">
                {history.result.data.map((event) => (
                  <li key={event.id} className="border-l-2 border-accent-500 pl-4">
                    <p className="font-semibold">
                      {event.acao === 'criacao' ? 'Criação' : 'Edição'} por{' '}
                      {event.administrador.nome}
                    </p>
                    <time dateTime={event.ocorrido_em} className="text-sm">
                      {new Date(event.ocorrido_em).toLocaleString('pt-BR')}
                    </time>
                    <ul className="mt-2 space-y-1 text-sm">
                      {event.alteracoes.map((change) => (
                        <li key={change.campo}>
                          <span className="font-medium">
                            {historyLabels[change.campo] ?? change.campo}
                          </span>
                          : {historyValue(change.campo, change.valor_anterior)} →{' '}
                          {historyValue(change.campo, change.valor_atual)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              {history.result.meta.total_pages > 1 && (
                <div className="flex items-center gap-4">
                  <button
                    className="underline"
                    type="button"
                    disabled={busy || history.result.meta.page <= 1}
                    onClick={() =>
                      void showHistory(history.profession, history.result.meta.page - 1)
                    }
                  >
                    Histórico anterior
                  </button>
                  <span>
                    {history.result.meta.page} de {history.result.meta.total_pages}
                  </span>
                  <button
                    className="underline"
                    type="button"
                    disabled={busy || history.result.meta.page >= history.result.meta.total_pages}
                    onClick={() =>
                      void showHistory(history.profession, history.result.meta.page + 1)
                    }
                  >
                    Próximo histórico
                  </button>
                </div>
              )}
            </section>
          )}
          <section
            className="panel space-y-5"
            aria-label="Profissões cadastradas"
            aria-busy={loading}
          >
            <form
              onSubmit={applyFilters}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
            >
              <label className="min-w-0 flex-1 font-medium">
                Buscar profissão
                <input
                  name="search"
                  className="field mt-2 w-full"
                  maxLength={120}
                  defaultValue={filters.search}
                />
              </label>
              <label className="font-medium">
                Situação
                <select name="ativo" className="field mt-2 block" defaultValue={filters.active}>
                  <option value="">Todas</option>
                  <option value="true">Ativas</option>
                  <option value="false">Inativas</option>
                </select>
              </label>
              <button className="btn compact" disabled={loading || busy}>
                Filtrar
              </button>
            </form>
            {!loading && page && (
              <>
                <p className="text-sm">{page.meta.total} profissão(ões) encontrada(s).</p>
                {page.data.length === 0 ? (
                  <p>Nenhuma profissão encontrada. Cadastre uma profissão ou ajuste os filtros.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {page.data.map((record) => (
                      <li
                        key={record.id}
                        className="flex flex-wrap items-center justify-between gap-4 py-4"
                      >
                        <div>
                          <h3 className="font-bold text-brand-500">{record.nome}</h3>
                          <span
                            className={
                              record.ativo ? 'text-sm text-green-800' : 'text-sm text-gray-500'
                            }
                          >
                            {record.ativo ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="font-semibold text-brand-500 underline"
                            aria-label={`Histórico de ${record.nome}`}
                            disabled={busy}
                            onClick={() => void showHistory(record)}
                          >
                            Histórico
                          </button>
                          <button
                            type="button"
                            className="font-semibold text-brand-500 underline"
                            aria-label={`Editar ${record.nome}`}
                            disabled={busy}
                            onClick={() => {
                              setEditing(record);
                              setName(record.nome);
                              setActive(record.ativo);
                              setNotice('');
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="font-semibold text-brand-500 underline"
                            aria-label={`${record.ativo ? 'Desativar' : 'Reativar'} ${record.nome}`}
                            disabled={busy}
                            onClick={() => void toggle(record)}
                          >
                            {record.ativo ? 'Desativar' : 'Reativar'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {page.meta.total_pages > 1 && (
                  <nav
                    aria-label="Paginação das profissões"
                    className="flex flex-wrap items-center justify-center gap-4"
                  >
                    <button
                      className="btn btn-outline compact"
                      type="button"
                      disabled={busy || filters.page <= 1}
                      onClick={() =>
                        setFilters((current) => ({ ...current, page: current.page - 1 }))
                      }
                    >
                      Anterior
                    </button>
                    <span>
                      Página {page.meta.page} de {page.meta.total_pages}
                    </span>
                    <button
                      className="btn btn-outline compact"
                      type="button"
                      disabled={busy || filters.page >= page.meta.total_pages}
                      onClick={() =>
                        setFilters((current) => ({ ...current, page: current.page + 1 }))
                      }
                    >
                      Próxima
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
