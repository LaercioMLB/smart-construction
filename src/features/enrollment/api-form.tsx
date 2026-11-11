'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { enrollmentApi, prepareEnrollment, PublicApiError } from '@/infrastructure/public';
import type {
  EnrollmentConfiguration,
  EnrollmentInput,
  ProfessionOption,
  Receipt,
} from './contracts';
import type { Course, ProfessionChoice } from '@/features/admin/registration-contracts';
import {
  professionalSchema,
  companySchema,
  states,
  normalizePhone,
  validateFiles,
} from './api-validation';
import { RegistrationContact } from './registration-contact';

const addressFields = [
  { name: 'cidade', label: 'Cidade', max: 120, required: true },
  { name: 'cep', label: 'CEP', max: 9, required: false },
  { name: 'rua', label: 'Rua', max: 200, required: false },
  { name: 'numero', label: 'Número', max: 30, required: false },
  { name: 'complemento', label: 'Complemento', max: 150, required: false },
  { name: 'bairro', label: 'Bairro', max: 120, required: false },
];
const fieldLabels: Record<string, string> = {
  nome: 'Nome completo',
  cpf: 'CPF',
  nascimento: 'Nascimento',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  endereco: 'Localização',
  biografia: 'Biografia',
  profissoes: 'Profissões',
  cursos: 'Cursos',
  razao_social: 'Razão social',
  nome_fantasia: 'Nome fantasia',
  cnpj: 'CNPJ',
  responsavel: 'Responsável',
  segmento: 'Segmento',
  descricao: 'Descrição',
};

export function ApiEnrollmentForm({
  kind,
  configuration,
}: {
  kind: 'profissional' | 'empresa';
  configuration: EnrollmentConfiguration;
}) {
  const [options, setOptions] = useState<ProfessionOption[]>([]);
  const [optionsReady, setOptionsReady] = useState(kind === 'empresa');
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [optionError, setOptionError] = useState('');
  const [choices, setChoices] = useState<ProfessionChoice[]>([
    { profissao_id: '', principal: true },
  ]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const attempt = useRef<{ key: string; body: FormData } | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (kind !== 'profissional') return;
    let cancelled = false;
    async function load() {
      try {
        const result = await enrollmentApi.professions();
        if (!cancelled) {
          setOptions(result);
          setOptionsReady(true);
          setOptionError('');
        }
      } catch {
        if (!cancelled) setOptionError('Não foi possível carregar as profissões. Tente novamente.');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [kind, optionsAttempt]);
  async function send() {
    const current = attempt.current;
    if (!current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setErrors({});
    try {
      setReceipt(await enrollmentApi.submit(kind, current.body, current.key));
      attempt.current = null;
      formRef.current?.reset();
      setChoices([]);
      setCourses([]);
    } catch (cause) {
      const retryable = cause instanceof PublicApiError && cause.retryable;
      if (!retryable) {
        attempt.current = null;
        setLocked(false);
      }
      if (cause instanceof PublicApiError && cause.code === 'REGISTRATIONS_DISABLED')
        setDisabled(true);
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir o cadastro.');
      if (cause instanceof PublicApiError)
        setErrors(
          Object.fromEntries(
            cause.fields.map((item) => [item.path.replace(/^body\./, ''), item.message]),
          ),
        );
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || locked || disabled || attempt.current) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const optional = (name: string) => text(name) || null;
    const file = (name: string) => {
      const item = data.get(name);
      return item instanceof File && item.size ? item : undefined;
    };
    const address = {
      cidade: text('endereco.cidade'),
      uf: text('endereco.uf'),
      cep: text('endereco.cep').replace(/\D/g, '') || null,
      rua: optional('endereco.rua'),
      numero: optional('endereco.numero'),
      complemento: optional('endereco.complemento'),
      bairro: optional('endereco.bairro'),
    };
    const common = {
      whatsapp: normalizePhone(text('whatsapp')),
      email: optional('email'),
      endereco: address,
    };
    const profile = file('foto_perfil');
    const logo = file('logo');
    const works = data
      .getAll('fotos_trabalhos')
      .filter((item): item is File => item instanceof File && item.size > 0);
    const fileError = validateFiles(profile, works, logo);
    if (fileError) {
      setError(fileError);
      setErrors({});
      return;
    }
    const result =
      kind === 'profissional'
        ? professionalSchema.safeParse({
            ...common,
            nome: text('nome'),
            cpf: text('cpf').replace(/[.\-\s]/g, ''),
            nascimento: optional('nascimento'),
            biografia: text('biografia'),
            profissoes: choices,
            cursos: courses,
          })
        : companySchema.safeParse({
            ...common,
            razao_social: text('razao_social'),
            nome_fantasia: optional('nome_fantasia'),
            cnpj: text('cnpj')
              .replace(/[.\-/\s]/g, '')
              .toUpperCase(),
            responsavel: text('responsavel'),
            segmento: text('segmento'),
            descricao: optional('descricao'),
          });
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      setError('Confira os campos indicados antes de enviar.');
      requestAnimationFrame(() => alertRef.current?.focus());
      return;
    }
    let input: EnrollmentInput;
    if (kind === 'profissional') {
      const parsed = professionalSchema.parse(result.data);
      input = { tipo: 'profissional', dados: parsed, foto_perfil: profile, fotos_trabalhos: works };
    } else {
      const parsed = companySchema.parse(result.data);
      input = { tipo: 'empresa', dados: parsed, logo };
    }
    attempt.current = { key: crypto.randomUUID(), body: prepareEnrollment(input, configuration) };
    setLocked(true);
    await send();
  }
  function field(
    name: string,
    label: string,
    required = false,
    max = 150,
    type = 'text',
    min?: number,
  ) {
    return (
      <label key={name}>
        {label}
        {required ? ' *' : ''}
        <input
          className="field mt-1"
          name={name}
          required={required}
          maxLength={max}
          minLength={min}
          type={type}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `error-${name}` : undefined}
        />
        {errors[name] && (
          <span className="mt-1 block text-sm text-red-700" id={`error-${name}`}>
            {errors[name]}
          </span>
        )}
      </label>
    );
  }
  function changeCourse(index: number, key: keyof Course, value: string) {
    setCourses((items) =>
      items.map((item, position) =>
        position !== index
          ? item
          : {
              ...item,
              [key]:
                key === 'inicio' || key === 'conclusao'
                  ? value
                    ? Number(value)
                    : null
                  : value || (key === 'nome' ? '' : null),
            },
      ),
    );
  }
  if (receipt)
    return (
      <section className="panel space-y-5" aria-live="polite">
        <h2 className="text-2xl font-bold text-brand-500">Cadastro recebido</h2>
        <p>Seu cadastro foi enviado e aguarda a análise da equipe Smart Construction.</p>
        <p className="break-all">
          <strong>Protocolo:</strong> {receipt.protocolo}
        </p>
        <p>Status: Em análise</p>
        <p className="text-sm text-gray-600">
          Recebido em {new Date(receipt.recebido_em).toLocaleString('pt-BR')}. Guarde o protocolo
          para falar com a nossa equipe.
        </p>
        <Link className="btn" href="/">
          Voltar para a Home
        </Link>
      </section>
    );
  if (disabled)
    return (
      <>
        <p role="alert" className="mb-5 text-red-700">
          {error}
        </p>
        <RegistrationContact />
      </>
    );
  return (
    <form
      ref={formRef}
      onSubmit={(event) => void submit(event)}
      className="panel space-y-7 p-6 sm:p-8"
    >
      <p className="text-sm text-gray-600">
        * Campos obrigatórios. O cadastro será analisado pela equipe. Não é necessário enviar fotos
        para se cadastrar.
      </p>
      {(error || Object.keys(errors).length > 0) && (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="space-y-2 rounded-lg bg-red-50 p-4 text-red-800"
        >
          <p>{error}</p>
          <ul>
            {Object.entries(errors).map(([path, message]) => (
              <li key={path}>
                <a
                  href={`#field-${path}`}
                  onClick={(event) => {
                    event.preventDefault();
                    const input = formRef.current?.querySelector<HTMLElement>(
                      `[name="${CSS.escape(path)}"]`,
                    );
                    input?.focus();
                  }}
                >
                  {fieldLabels[path.split('.')[0]] ?? 'Dados do cadastro'}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {locked && !busy && (
        <p role="status" className="rounded-lg bg-brand-50 p-4 text-brand-700">
          Ainda não foi possível confirmar o envio. Mantenha esta página aberta e tente reenviar a
          mesma tentativa.
        </p>
      )}
      <fieldset disabled={busy || locked} className="space-y-7">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-4 text-lg font-bold text-brand-500">
            {kind === 'profissional' ? 'Dados pessoais' : 'Dados da empresa'}
          </legend>
          {kind === 'profissional' ? (
            <>
              {field('nome', 'Nome completo', true, 150, 'text', 3)}
              {field('cpf', 'CPF', true, 14)}
              {field('nascimento', 'Nascimento', false, 10, 'date')}
            </>
          ) : (
            <>
              {field('razao_social', 'Razão social', true, 200, 'text', 3)}
              {field('nome_fantasia', 'Nome fantasia', false, 200)}
              {field('cnpj', 'CNPJ', true, 18)}
              {field('responsavel', 'Responsável', true, 150, 'text', 3)}
              {field('segmento', 'Segmento', true)}
            </>
          )}
          {field('whatsapp', 'WhatsApp com DDD', true, 20, 'tel')}
          {field('email', 'E-mail', false, 254, 'email')}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-4 text-lg font-bold text-brand-500">Localização</legend>
          {addressFields.map((item) =>
            field(`endereco.${item.name}`, item.label, item.required, item.max),
          )}
          <label>
            UF *
            <select className="field mt-1" name="endereco.uf" defaultValue="" required>
              <option value="" disabled>
                Selecione
              </option>
              {states.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </label>
        </fieldset>
        {kind === 'profissional' ? (
          <>
            <fieldset className="space-y-4">
              <legend className="mb-3 text-lg font-bold text-brand-500">Profissões</legend>
              <p className="text-sm text-gray-600">
                Escolha de uma a cinco profissões e marque uma principal. Use Outra para sugerir uma
                profissão.
              </p>
              {optionError ? (
                <p role="alert" className="text-red-700">
                  {optionError}{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setOptionsAttempt((value) => value + 1)}
                  >
                    Tentar carregar profissões
                  </button>
                </p>
              ) : (
                !optionsReady && <p role="status">Carregando profissões…</p>
              )}
              {choices.map((choice, index) => (
                <div key={index} className="space-y-3 rounded-lg border border-gray-200 p-3">
                  <label>
                    Profissão {index + 1} *
                    <select
                      className="field mt-1"
                      required
                      value={'profissao_id' in choice ? choice.profissao_id : 'outra'}
                      onChange={(event) =>
                        setChoices((items) =>
                          items.map((item, position) =>
                            position !== index
                              ? item
                              : event.target.value === 'outra'
                                ? { sugestao: '', principal: item.principal }
                                : { profissao_id: event.target.value, principal: item.principal },
                          ),
                        )
                      }
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {options.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                      <option value="outra">Outra / sugestão</option>
                    </select>
                  </label>
                  {'sugestao' in choice && (
                    <label className="block">
                      Sugestão {index + 1} *
                      <input
                        className="field mt-1"
                        required
                        minLength={2}
                        maxLength={100}
                        value={choice.sugestao}
                        onChange={(event) =>
                          setChoices((items) =>
                            items.map((item, position) =>
                              position !== index
                                ? item
                                : { sugestao: event.target.value, principal: item.principal },
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="principal"
                        required
                        checked={choice.principal}
                        onChange={() =>
                          setChoices((items) =>
                            items.map((item, position) => ({
                              ...item,
                              principal: position === index,
                            })),
                          )
                        }
                      />
                      Principal
                    </label>
                    <button
                      className="btn btn-outline"
                      type="button"
                      disabled={choices.length <= 1}
                      onClick={() =>
                        setChoices((items) => {
                          const next = items.filter((_, position) => position !== index);
                          return choice.principal
                            ? next.map((item, position) => ({ ...item, principal: position === 0 }))
                            : next;
                        })
                      }
                    >
                      Remover profissão {index + 1}
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-outline"
                type="button"
                disabled={choices.length >= 5}
                onClick={() =>
                  setChoices((items) => [...items, { profissao_id: '', principal: false }])
                }
              >
                Adicionar profissão
              </button>
            </fieldset>
            <label className="block">
              Biografia *
              <textarea
                className="field mt-1 min-h-28"
                name="biografia"
                minLength={20}
                maxLength={400}
                required
              />
            </label>
            <fieldset className="space-y-4">
              <legend className="mb-3 text-lg font-bold text-brand-500">
                Cursos (opcional, até 10)
              </legend>
              {courses.map((course, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2"
                >
                  <label>
                    Nome do curso {index + 1} *
                    <input
                      className="field mt-1"
                      required
                      maxLength={150}
                      value={course.nome}
                      onChange={(event) => changeCourse(index, 'nome', event.target.value)}
                    />
                  </label>
                  <label>
                    Instituição {index + 1}
                    <input
                      className="field mt-1"
                      maxLength={150}
                      value={course.instituicao ?? ''}
                      onChange={(event) => changeCourse(index, 'instituicao', event.target.value)}
                    />
                  </label>
                  {(['inicio', 'conclusao'] as const).map((key) => (
                    <label key={key}>
                      {key === 'inicio' ? 'Início' : 'Conclusão'} {index + 1}
                      <input
                        className="field mt-1"
                        type="number"
                        min={1900}
                        max={new Date().getFullYear()}
                        value={course[key] ?? ''}
                        onChange={(event) => changeCourse(index, key, event.target.value)}
                      />
                    </label>
                  ))}
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() =>
                      setCourses((items) => items.filter((_, position) => position !== index))
                    }
                  >
                    Remover curso {index + 1}
                  </button>
                </div>
              ))}
              <button
                className="btn btn-outline"
                type="button"
                disabled={courses.length >= 10}
                onClick={() =>
                  setCourses((items) => [
                    ...items,
                    { nome: '', instituicao: null, inicio: null, conclusao: null },
                  ])
                }
              >
                Adicionar curso
              </button>
            </fieldset>
          </>
        ) : (
          <label className="block">
            Descrição
            <textarea className="field mt-1 min-h-28" name="descricao" maxLength={1000} />
          </label>
        )}
        <fieldset className="space-y-4">
          <legend className="mb-3 text-lg font-bold text-brand-500">Imagens (opcional)</legend>
          <p className="text-sm text-gray-600">JPG/PNG, até 5 MiB por imagem.</p>
          {kind === 'profissional' ? (
            <>
              <label className="block">
                Foto de perfil
                <input
                  className="field mt-1"
                  type="file"
                  name="foto_perfil"
                  accept="image/jpeg,image/png"
                />
              </label>
              <label className="block">
                Fotos de trabalhos (até 6)
                <input
                  className="field mt-1"
                  type="file"
                  name="fotos_trabalhos"
                  accept="image/jpeg,image/png"
                  multiple
                />
              </label>
            </>
          ) : (
            <label className="block">
              Logo da empresa
              <input className="field mt-1" type="file" name="logo" accept="image/jpeg,image/png" />
            </label>
          )}
        </fieldset>
        <fieldset className="space-y-4 border-t border-gray-100 pt-5">
          <legend className="mb-3 text-lg font-bold text-brand-500">Autorizações</legend>
          <label className="flex items-start gap-3">
            <input type="checkbox" required name="maioridade" className="mt-1" />
            <span>
              Declaro ter 18 anos ou mais e ser responsável pelas informações deste cadastro.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" required name="termos" className="mt-1" />
            <span>
              Li e aceito os{' '}
              <Link className="underline" target="_blank" href="/termos-de-uso">
                Termos de Uso
              </Link>{' '}
              (versão {configuration.versao_termos}).
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" required name="privacidade" className="mt-1" />
            <span>
              Li e estou ciente da{' '}
              <Link className="underline" target="_blank" href="/politica-de-privacidade">
                Política de Privacidade
              </Link>{' '}
              (versão {configuration.versao_privacidade}).
            </span>
          </label>
          {kind === 'profissional' && (
            <label className="flex items-start gap-3">
              <input type="checkbox" required name="publicacao" className="mt-1" />
              <span>
                Autorizo a publicação do meu nome, biografia, profissões, cidade/UF, cursos e
                imagens após aprovação. Documentos, contatos e endereço completo ficam privados.
              </span>
            </label>
          )}
        </fieldset>
      </fieldset>
      <button
        className="btn"
        type={locked ? 'button' : 'submit'}
        disabled={busy || !optionsReady}
        onClick={locked ? () => void send() : undefined}
      >
        {busy ? 'Enviando…' : locked ? 'Reenviar mesma tentativa' : 'Enviar cadastro'}
      </button>
    </form>
  );
}
