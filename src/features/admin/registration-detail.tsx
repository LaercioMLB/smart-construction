'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminRepository } from '@/infrastructure/admin';
import { AdminError, type AdminSession, type Profession } from './contracts';
import type {
  Registration,
  RegistrationAction,
  RegistrationChanges,
  RegistrationHistory,
  RegistrationFile,
} from './registration-contracts';
import { RegistrationImages } from './registration-images';
import { RegistrationForm } from './registration-form';
import { statusLabels } from './registrations-panel';

const actions = {
  aprovar: 'Aprovar cadastro',
  reprovar: 'Reprovar cadastro',
  reabrir: 'Reabrir análise',
  publicar: 'Republicar profissional',
  despublicar: 'Despublicar profissional',
};
const actionLabels: Record<string, string> = {
  criacao: 'Recebimento',
  edicao: 'Edição',
  aprovacao: 'Aprovação',
  reprovacao: 'Reprovação',
  reabertura: 'Reabertura',
  publicacao: 'Publicação',
  despublicacao: 'Despublicação',
};

export function RegistrationDetail({ id }: { id: string }) {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [record, setRecord] = useState<Registration | null>(null);
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [history, setHistory] = useState<RegistrationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [reload, setReload] = useState(0);
  const failure = useCallback(
    (cause: unknown) => {
      if (cause instanceof AdminError && cause.status === 401) {
        setSession(null);
        setRecord(null);
        setHistory(null);
        router.replace('/admin/login');
      } else {
        if (cause instanceof AdminError && cause.status === 412) setStale(true);
        setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.');
      }
    },
    [router],
  );
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setRecord(null);
      setHistory(null);
      try {
        const auth = await adminRepository.session();
        if (cancelled) return;
        setSession(auth);
        const [item, events] = await Promise.all([
          adminRepository.registration(id),
          adminRepository.registrationHistory(id, 1),
        ]);
        const options: Profession[] = [];
        if (item.tipo === 'profissional') {
          let page = 1;
          let pages = 1;
          do {
            const result = await adminRepository.professions({ page, search: '', active: '' });
            options.push(...result.data);
            pages = result.meta.total_pages;
            page += 1;
          } while (page <= pages && !cancelled);
        }
        if (!cancelled) {
          setRecord(item);
          setHistory(events);
          setProfessions(options);
          setStale(false);
        }
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
  }, [id, reload, failure]);
  async function complete(item: Registration, message: string) {
    setRecord(item);
    setReason('');
    setNotice(message);
    setHistory(null);
    setHistory(await adminRepository.registrationHistory(id, 1));
  }
  async function save(changes: RegistrationChanges) {
    if (!record || !session || busy || stale) return;
    if (
      record.status === 'aprovado' &&
      !window.confirm(
        record.tipo === 'profissional' && record.publicacao.publicado
          ? 'Salvar e atualizar imediatamente os dados públicos deste profissional?'
          : 'Salvar as alterações deste cadastro aprovado?',
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await complete(
        await adminRepository.updateRegistration(record, changes, session.csrf_token),
        'Cadastro atualizado. Alterações registradas no histórico.',
      );
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  async function decide(action: RegistrationAction) {
    if (!record || !session || busy || stale) return;
    if (action === 'reprovar' && !reason.trim()) {
      setError('Informe o motivo da reprovação.');
      return;
    }
    const message =
      action === 'aprovar'
        ? record.tipo === 'profissional'
          ? 'Aprovar e disponibilizar este profissional na API pública?'
          : 'Aprovar esta empresa? O cadastro continuará privado.'
        : `${actions[action]}?`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await complete(
        await adminRepository.decideRegistration(record, action, session.csrf_token, reason.trim()),
        `${actions[action]}: operação concluída.`,
      );
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  async function historyPage(page: number) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setHistory(await adminRepository.registrationHistory(id, page));
    } catch (cause) {
      failure(cause);
    } finally {
      setBusy(false);
    }
  }
  async function imageChange(
    file: File | RegistrationFile,
    purpose?: RegistrationFile['finalidade'],
  ): Promise<boolean> {
    if (!record || !session || busy || stale) return false;
    const message = purpose
      ? 'Enviar esta imagem? A foto de perfil ou logo anterior será substituída.'
      : 'Remover esta imagem do cadastro?';
    if (
      !window.confirm(
        message +
          (record.tipo === 'profissional' && record.publicacao.publicado
            ? ' A publicação será atualizada imediatamente.'
            : ''),
      )
    )
      return false;
    setBusy(true);
    setError('');
    setNotice('');
    let changed = false;
    try {
      if (file instanceof File && purpose)
        await adminRepository.uploadRegistrationFile(record, file, purpose, session.csrf_token);
      else if (!(file instanceof File))
        await adminRepository.removeRegistrationFile(record, file, session.csrf_token);
      changed = true;
      await complete(
        await adminRepository.registration(id),
        'Imagens atualizadas e alteração registrada no histórico.',
      );
      return true;
    } catch (cause) {
      if (changed) setStale(true);
      failure(cause);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <Link className="text-sm font-semibold text-brand-500 underline" href="/admin/cadastros">
        Voltar aos cadastros
      </Link>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">
          {notice}
        </p>
      )}
      <button
        className="btn btn-outline"
        disabled={busy || loading}
        onClick={() => {
          if (!record || window.confirm('Recarregar e descartar alterações ainda não salvas?')) {
            setNotice('');
            setReload((value) => value + 1);
          }
        }}
      >
        Recarregar cadastro
      </button>
      {loading && <p role="status">Carregando cadastro…</p>}
      {record && (
        <>
          <header className="space-y-2">
            <h1 className="break-words text-3xl font-bold text-brand-500">
              {record.tipo === 'profissional'
                ? record.dados.nome
                : record.dados.nome_fantasia || record.dados.razao_social}
            </h1>
            <p>
              {record.tipo === 'profissional' ? 'Profissional' : 'Empresa'} ·{' '}
              {statusLabels[record.status]} · Versão {record.versao}
            </p>
            <p className="break-all text-sm text-gray-600">Protocolo: {record.protocolo}</p>
            {record.tipo === 'profissional' ? (
              <p className="font-semibold text-brand-500">
                {record.publicacao.publicado ? 'Disponível na API pública' : 'Não publicado'}
              </p>
            ) : (
              <p className="text-gray-600">Cadastro exclusivo do painel administrativo.</p>
            )}
            {record.motivo_reprovacao && (
              <p className="rounded-lg bg-accent-50 p-3">
                Motivo da reprovação: {record.motivo_reprovacao}
              </p>
            )}
          </header>
          <RegistrationForm
            key={`${record.id}-${record.versao}-${reload}`}
            record={record}
            professions={professions}
            disabled={busy || stale}
            onSave={save}
          />
          <RegistrationImages
            key={`${record.id}-${record.versao}`}
            record={record}
            disabled={busy || stale}
            onUpload={(file, purpose) => imageChange(file, purpose)}
            onRemove={async (file) => {
              await imageChange(file);
            }}
          />
          <section className="panel space-y-4 p-5">
            <h2 className="text-xl font-bold text-brand-500">Análise</h2>
            {stale && (
              <p className="text-red-800">Recarregue o cadastro para usar a versão atual.</p>
            )}
            {record.status === 'pendente' && (
              <>
                <p className="text-sm text-gray-600">
                  Confira os dados e as imagens antes de decidir. Sugestões de profissão devem ser
                  resolvidas antes da aprovação.
                </p>
                <button
                  className="btn btn-primary"
                  disabled={busy || stale}
                  onClick={() => void decide('aprovar')}
                >
                  Aprovar cadastro
                </button>
                <label className="block">
                  Motivo da reprovação
                  <textarea
                    className="field mt-1"
                    maxLength={1000}
                    disabled={busy || stale}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <button
                  className="btn btn-outline"
                  disabled={busy || stale || !reason.trim()}
                  onClick={() => void decide('reprovar')}
                >
                  Reprovar cadastro
                </button>
              </>
            )}
            {record.status === 'reprovado' && (
              <button
                className="btn btn-primary"
                disabled={busy || stale}
                onClick={() => void decide('reabrir')}
              >
                Reabrir análise
              </button>
            )}
            {record.status === 'aprovado' && record.tipo === 'profissional' && (
              <button
                className="btn btn-outline"
                disabled={busy || stale}
                onClick={() =>
                  void decide(record.publicacao.publicado ? 'despublicar' : 'publicar')
                }
              >
                {record.publicacao.publicado
                  ? 'Despublicar profissional'
                  : 'Republicar profissional'}
              </button>
            )}
            {record.status === 'aprovado' && record.tipo === 'empresa' && (
              <p>Empresa aprovada e mantida privada.</p>
            )}
          </section>
          <section className="panel p-5">
            <h2 className="mb-3 text-xl font-bold text-brand-500">Aceites recebidos</h2>
            <ul className="space-y-2 text-sm">
              {record.aceites.map((consent) => (
                <li key={consent.tipo}>
                  {consent.tipo === 'termos'
                    ? 'Termos'
                    : consent.tipo === 'privacidade'
                      ? 'Privacidade'
                      : consent.tipo === 'maioridade'
                        ? 'Declaração de maioridade'
                        : 'Autorização de publicação'}{' '}
                  · versão {consent.versao} · {new Date(consent.aceito_em).toLocaleString('pt-BR')}
                </li>
              ))}
            </ul>
          </section>
          <section className="panel space-y-4 p-5">
            <h2 className="text-xl font-bold text-brand-500">Histórico do cadastro</h2>
            {history ? (
              <>
                <ol className="space-y-4">
                  {history.data.map((event) => (
                    <li key={event.id} className="rounded-lg border border-gray-200 p-4">
                      <p className="font-semibold">
                        {actionLabels[event.acao] ?? event.acao} ·{' '}
                        {new Date(event.ocorrido_em).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {event.administrador?.nome ?? 'Envio pelo formulário'}
                      </p>
                      {event.motivo && <p className="mt-2 break-words">Motivo: {event.motivo}</p>}
                      <ul className="mt-3 space-y-2 text-sm">
                        {event.alteracoes.map((change) => (
                          <li key={change.campo} className="break-words">
                            <strong>{change.campo}</strong>
                            <p className="whitespace-pre-wrap">
                              Antes: {change.valor_anterior ?? '—'}
                            </p>
                            <p className="whitespace-pre-wrap">
                              Depois: {change.valor_atual ?? '—'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center justify-between gap-3">
                  <button
                    className="btn btn-outline"
                    disabled={busy || history.meta.page <= 1}
                    onClick={() => void historyPage(history.meta.page - 1)}
                  >
                    Histórico anterior
                  </button>
                  <span className="text-sm">Página {history.meta.page}</span>
                  <button
                    className="btn btn-outline"
                    disabled={busy || history.meta.page >= history.meta.total_pages}
                    onClick={() => void historyPage(history.meta.page + 1)}
                  >
                    Próximo histórico
                  </button>
                </div>
              </>
            ) : (
              <button
                className="btn btn-outline"
                disabled={busy}
                onClick={() => void historyPage(1)}
              >
                Carregar histórico
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
