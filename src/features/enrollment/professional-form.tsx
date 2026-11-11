'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Service } from '@/shared/types/service';
import { maskCpf, maskPhone, maskDate, maskCep } from '@/shared/masks';
import {
  enrollmentRepository,
  emptyDraft,
  validateStep,
  type ProfessionalDraft,
  type SelectedCategory,
} from './repository';
import { UF_OPTIONS } from './schemas';
import { Field } from './field';
import { FilePicker } from './file-picker';
const steps = [
  'Dados pessoais',
  'Endereço',
  'Foto e categorias',
  'Sobre o trabalho',
  'Revisão final',
];
export function ProfessionalForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const lookupId = useRef(0);
  const [draft, setDraft] = useState<ProfessionalDraft>(emptyDraft);
  const [resume, setResume] = useState<ProfessionalDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [cepStatus, setCepStatus] = useState('');
  const [categoryText, setCategoryText] = useState('');
  const [profileFiles, setProfileFiles] = useState<File[]>([]);
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  useEffect(() => {
    let active = true;
    enrollmentRepository.loadDraft().then((saved) => {
      if (active) {
        setResume(saved);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || resume || !dirty) return;
    let active = true;
    const timer = setTimeout(() => {
      enrollmentRepository.saveDraft(draft).then((saved) => {
        if (active) setStorageError(!saved);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, ready, resume, dirty]);
  const update = (changes: Partial<ProfessionalDraft>) => {
    setDirty(true);
    setDraft((old) => ({ ...old, ...changes }));
  };
  const personal = (key: keyof ProfessionalDraft['personal'], value: string) =>
    update({ personal: { ...draft.personal, [key]: value } });
  const address = (key: keyof ProfessionalDraft['address'], value: string) =>
    update({ address: { ...draft.address, [key]: value } });
  const focus = () => requestAnimationFrame(() => heading.current?.focus());
  const go = (step: number) => {
    if (step > draft.step) {
      for (let s = 1; s < step; s++) {
        const invalid = validateStep(draft, s);
        if (Object.keys(invalid).length) {
          setErrors(invalid);
          update({ step: s });
          focus();
          return;
        }
      }
    }
    setErrors({});
    update({ step });
    focus();
  };
  async function next() {
    const invalid = validateStep(draft, draft.step);
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid=true]')?.focus(),
      );
      return;
    }
    setErrors({});
    update({
      step: Math.min(5, draft.step + 1),
      completed: [...new Set([...draft.completed, draft.step])],
    });
    focus();
  }
  async function lookup(cep: string) {
    const id = ++lookupId.current;
    if (cep.replace(/\D/g, '').length !== 8) {
      setCepStatus('');
      return;
    }
    setCepStatus('Consultando CEP…');
    try {
      const result = await enrollmentRepository.lookupCep(cep);
      if (id !== lookupId.current) return;
      if (result) {
        setDraft((old) => ({
          ...old,
          address: {
            ...old.address,
            ...result,
            numero: old.address.numero,
            complemento: old.address.complemento,
          },
        }));
        setCepStatus('Endereço de demonstração preenchido.');
      } else setCepStatus('CEP não encontrado na demonstração. Preencha o endereço manualmente.');
    } catch {
      if (id === lookupId.current)
        setCepStatus('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    }
  }
  const addCategory = (text: string) => {
    const name = text.trim();
    if (
      !name ||
      draft.categories.some(
        (c) => c.nome_profissao.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      return;
    if (draft.categories.length >= 5) {
      setErrors({ categorias: 'Você pode escolher no máximo 5 profissões' });
      return;
    }
    const service = services.find((s) => s.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const category: SelectedCategory = service
      ? {
          id_profissao: Number(service.id),
          nome_profissao: service.name,
          principal: draft.categories.length === 0,
        }
      : { texto: name, nome_profissao: name, principal: draft.categories.length === 0 };
    update({ categories: [...draft.categories, category] });
    setCategoryText('');
    setErrors({});
  };
  const removeCategory = (index: number) => {
    const next = draft.categories.filter((_, n) => n !== index);
    if (next.length && !next.some((c) => c.principal)) next[0] = { ...next[0], principal: true };
    update({ categories: next });
  };
  async function submit() {
    if (pending) return;
    setPending(true);
    setErrors({});
    try {
      await enrollmentRepository.submit(draft, accepted, [...profileFiles, ...portfolioFiles]);
      setDirty(false);
      router.push('/faca-parte/profissional/sucesso');
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error ? error.message : 'Não foi possível enviar. Tente novamente.',
      });
    } finally {
      setPending(false);
    }
  }
  if (!ready)
    return <div className="skeleton h-96" role="status" aria-label="Carregando cadastro" />;
  return (
    <div>
      {resume && (
        <div className="mb-6 rounded-xl border border-accent-200 bg-accent-50 p-5">
          <h2 className="mb-2 font-bold text-brand-500">Você tem um cadastro em andamento</h2>
          <p className="mb-4 text-sm text-gray-600">Deseja continuar de onde parou?</p>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn compact"
              onClick={() => {
                setDraft(resume);
                setResume(null);
                setDirty(true);
              }}
            >
              Continuar cadastro
            </button>
            <button
              className="btn btn-outline compact"
              onClick={() => {
                void enrollmentRepository.discardDraft();
                setResume(null);
              }}
            >
              Descartar rascunho
            </button>
          </div>
        </div>
      )}
      <p className="mb-6 rounded-lg bg-brand-50 p-3 text-sm text-brand-500">
        Demonstração local. Use apenas dados fictícios. Nenhum cadastro ou arquivo é enviado.
      </p>
      {storageError && (
        <p role="status" className="mb-4 text-sm text-accent-700">
          Não foi possível salvar o rascunho neste navegador. Você pode continuar nesta sessão.
        </p>
      )}
      <nav aria-label="Etapas do cadastro" className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {steps.map((title, index) => (
          <button
            key={title}
            className={`flex min-w-32 flex-1 items-center gap-2 rounded-lg border px-3 py-3 text-left text-xs font-medium ${draft.step === index + 1 ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-gray-200 text-gray-500'}`}
            aria-current={draft.step === index + 1 ? 'step' : undefined}
            onClick={() => go(index + 1)}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
              {index + 1}
            </span>
            {title}
          </button>
        ))}
      </nav>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.step < 5) void next();
          else void submit();
        }}
        className="panel p-6 sm:p-8"
      >
        <p className="mb-2 text-xs font-bold tracking-wide text-accent-500 uppercase">
          Etapa {draft.step} de 5
        </p>
        <h2 ref={heading} tabIndex={-1} className="mb-6 text-2xl font-bold text-brand-500">
          {steps[draft.step - 1]}
        </h2>
        {Object.keys(errors).length > 0 && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {Object.values(errors).map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        )}
        <div hidden={draft.step !== 1} className="space-y-5">
          <Field
            name="nome"
            label="Nome completo"
            value={draft.personal.nome}
            onChange={(value) => personal('nome', value)}
            error={errors.nome}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              name="cpf"
              label="CPF"
              inputMode="numeric"
              value={draft.personal.cpf}
              onChange={(value) => personal('cpf', maskCpf(value))}
              error={errors.cpf}
              placeholder="000.000.000-00"
            />
            <Field
              name="data_de_nascimento"
              label="Data de nascimento"
              inputMode="numeric"
              value={draft.personal.data_de_nascimento}
              onChange={(value) => personal('data_de_nascimento', maskDate(value))}
              error={errors.data_de_nascimento}
              placeholder="dd/mm/aaaa"
            />
          </div>
          <Field
            name="telefone"
            label="Telefone / WhatsApp"
            inputMode="tel"
            value={draft.personal.telefone}
            onChange={(value) => personal('telefone', maskPhone(value))}
            error={errors.telefone}
          />
          <Field
            name="email"
            label="E-mail"
            optional
            type="email"
            value={draft.personal.email}
            onChange={(value) => personal('email', value)}
            error={errors.email}
          />
        </div>
        <div hidden={draft.step !== 2} className="space-y-5">
          <Field
            name="cep"
            label="CEP"
            inputMode="numeric"
            value={draft.address.cep}
            onChange={(value) => {
              const masked = maskCep(value);
              address('cep', masked);
              void lookup(masked);
            }}
            error={errors.cep}
            placeholder="00000-000"
          />
          {cepStatus && (
            <p role="status" className="text-sm text-accent-700">
              {cepStatus}
            </p>
          )}
          <p className="text-xs text-gray-400">CEP para testar preenchimento: 85854-000.</p>
          <Field
            name="rua"
            label="Rua"
            value={draft.address.rua}
            onChange={(value) => address('rua', value)}
            error={errors.rua}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              name="numero"
              label="Número"
              optional
              value={draft.address.numero}
              onChange={(value) => address('numero', value)}
            />
            <div className="sm:col-span-2">
              <Field
                name="complemento"
                label="Complemento"
                optional
                value={draft.address.complemento}
                onChange={(value) => address('complemento', value)}
              />
            </div>
          </div>
          <Field
            name="bairro"
            label="Bairro"
            value={draft.address.bairro}
            onChange={(value) => address('bairro', value)}
            error={errors.bairro}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field
                name="cidade"
                label="Cidade"
                value={draft.address.cidade}
                onChange={(value) => address('cidade', value)}
                error={errors.cidade}
              />
            </div>
            <div>
              <label htmlFor="estado" className="field-label">
                Estado *
              </label>
              <select
                id="estado"
                className="field"
                value={draft.address.estado}
                onChange={(event) => address('estado', event.target.value)}
                aria-invalid={Boolean(errors.estado)}
              >
                <option value="">Selecione</option>
                {UF_OPTIONS.map((uf) => (
                  <option value={uf.value} key={uf.value}>
                    {uf.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div hidden={draft.step !== 3} className="space-y-8">
          <FilePicker label="Foto de perfil" max={1} onChange={setProfileFiles} />
          <section>
            <h3 className="field-label">Categorias de atuação *</h3>
            <p className="mb-4 text-sm text-gray-500">
              Escolha até 5 profissões e marque uma como principal. Você também pode escrever outra
              profissão.
            </p>
            <div className="mb-4 flex gap-3">
              <input
                className="field"
                list="profissoes"
                value={categoryText}
                onChange={(event) => setCategoryText(event.target.value)}
                aria-label="Adicionar profissão"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCategory(categoryText);
                  }
                }}
              />
              <datalist id="profissoes">
                {services
                  .filter((s) => !draft.categories.some((c) => c.nome_profissao === s.name))
                  .map((s) => (
                    <option key={s.slug} value={s.name} />
                  ))}
              </datalist>
              <button
                type="button"
                className="btn compact"
                onClick={() => addCategory(categoryText)}
              >
                Adicionar
              </button>
            </div>
            <div className="space-y-3">
              {draft.categories.map((category, index) => (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm"
                  key={category.nome_profissao}
                >
                  <span className="grow font-semibold text-brand-500">
                    {category.nome_profissao}
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="principal"
                      checked={category.principal}
                      onChange={() =>
                        update({
                          categories: draft.categories.map((c, n) => ({
                            ...c,
                            principal: n === index,
                          })),
                        })
                      }
                      className="accent-accent-500"
                    />
                    Principal
                  </label>
                  <button
                    type="button"
                    className="text-red-600"
                    aria-label={`Remover ${category.nome_profissao}`}
                    onClick={() => removeCategory(index)}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div hidden={draft.step !== 4} className="space-y-8">
          <div>
            <label htmlFor="bio" className="field-label">
              Sobre você *
            </label>
            <p className="mb-3 text-sm text-gray-500">
              Conte sua experiência, no que é especialista e o que entrega de diferente.
            </p>
            <textarea
              id="bio"
              value={draft.bio}
              maxLength={400}
              rows={5}
              onChange={(event) => update({ bio: event.target.value })}
              className="field"
              aria-invalid={Boolean(errors.bio)}
            />
            <p className="text-right text-xs text-gray-400">{draft.bio.trim().length}/400</p>
          </div>
          <FilePicker label="Fotos do seu trabalho" max={6} onChange={setPortfolioFiles} />
          <section>
            <h3 className="field-label">Cursos e certificações</h3>
            <p className="mb-4 text-sm text-gray-500">Opcional. Adicione até 10 cursos.</p>
            <div className="space-y-4">
              {draft.courses.map((course, index) => (
                <div className="rounded-xl border border-gray-200 p-4" key={index}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(['nome', 'instituicao', 'inicio', 'conclusao'] as const).map((key) => (
                      <Field
                        key={key}
                        name={`curso-${index}-${key}`}
                        label={`${{ nome: 'Nome do curso', instituicao: 'Instituição', inicio: 'Ano de início', conclusao: 'Ano de conclusão' }[key]} ${index + 1}`}
                        value={course[key]}
                        optional={key !== 'nome'}
                        onChange={(value) =>
                          update({
                            courses: draft.courses.map((c, n) =>
                              n === index ? { ...c, [key]: value } : c,
                            ),
                          })
                        }
                        error={errors[`cursos.${index}.${key}`]}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-sm text-red-600"
                    onClick={() => update({ courses: draft.courses.filter((_, n) => n !== index) })}
                  >
                    Remover curso
                  </button>
                </div>
              ))}
            </div>
            {draft.courses.length < 10 && (
              <button
                type="button"
                className="btn btn-outline mt-4"
                onClick={() =>
                  update({
                    courses: [
                      ...draft.courses,
                      { nome: '', instituicao: '', inicio: '', conclusao: '' },
                    ],
                  })
                }
              >
                Adicionar curso
              </button>
            )}
          </section>
        </div>
        <div hidden={draft.step !== 5} className="space-y-5">
          <p className="text-sm text-gray-500">
            Confira seus dados antes de enviar. Você pode editar qualquer seção.
          </p>
          {[
            {
              title: 'Dados pessoais',
              step: 1,
              content: (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(draft.personal).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-gray-400">
                        {
                          {
                            nome: 'Nome',
                            cpf: 'CPF',
                            data_de_nascimento: 'Nascimento',
                            telefone: 'WhatsApp',
                            email: 'E-mail',
                          }[key]
                        }
                      </dt>
                      <dd>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
            {
              title: 'Endereço',
              step: 2,
              content: (
                <p className="text-sm">
                  {draft.address.rua}, {draft.address.numero || 'S/N'} {draft.address.complemento} —{' '}
                  {draft.address.bairro}, {draft.address.cidade}/{draft.address.estado} — CEP{' '}
                  {draft.address.cep}
                </p>
              ),
            },
            {
              title: 'Foto e categorias',
              step: 3,
              content: (
                <p className="text-sm">
                  {draft.categories
                    .map((c) => c.nome_profissao + (c.principal ? ' (principal)' : ''))
                    .join(', ')}
                  <br />
                  {profileFiles.length
                    ? 'Foto selecionada'
                    : 'Nenhuma foto selecionada. Se recarregou a página, reselecione a foto.'}
                </p>
              ),
            },
            {
              title: 'Sobre o trabalho',
              step: 4,
              content: (
                <div className="space-y-2 text-sm">
                  <p>{draft.bio}</p>
                  <p>{portfolioFiles.length} fotos de trabalhos selecionadas</p>
                  {draft.courses.map((c, n) => (
                    <p key={n}>
                      {c.nome} — {c.instituicao} {c.inicio}–{c.conclusao}
                    </p>
                  ))}
                </div>
              ),
            },
          ].map((item) => (
            <section key={item.title} className="rounded-xl border border-gray-200 p-5">
              <div className="mb-3 flex justify-between">
                <h3 className="font-bold text-brand-500">{item.title}</h3>
                <button
                  type="button"
                  className="text-sm font-semibold text-accent-600"
                  aria-label={`Editar ${item.title.toLowerCase()}`}
                  onClick={() => go(item.step)}
                >
                  Editar
                </button>
              </div>
              {item.content}
            </section>
          ))}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-accent-500"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>
              Li e aceito os{' '}
              <Link href="/termos-de-uso" className="text-accent-600 underline" target="_blank">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link
                href="/politica-de-privacidade"
                target="_blank"
                className="text-accent-600 underline"
              >
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
        </div>
        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-6">
          {draft.step > 1 ? (
            <button type="button" className="btn btn-outline" onClick={() => go(draft.step - 1)}>
              Voltar
            </button>
          ) : (
            <Link className="btn btn-outline" href="/faca-parte">
              Cancelar
            </Link>
          )}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Registrando…' : draft.step === 5 ? 'Finalizar cadastro' : 'Avançar'}
          </button>
        </div>
      </form>
    </div>
  );
}
