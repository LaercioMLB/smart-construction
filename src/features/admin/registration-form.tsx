'use client';

import { useState, type FormEvent } from 'react';
import type { Profession } from './contracts';
import type {
  Address,
  Course,
  ProfessionChoice,
  Registration,
  RegistrationChanges,
} from './registration-contracts';

const states = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];
const addressFields = [
  { name: 'cidade', label: 'Cidade', max: 120, required: true },
  { name: 'cep', label: 'CEP (8 dígitos)', max: 8 },
  { name: 'rua', label: 'Rua', max: 200 },
  { name: 'numero', label: 'Número', max: 30 },
  { name: 'complemento', label: 'Complemento', max: 150 },
  { name: 'bairro', label: 'Bairro', max: 120 },
] as const;

export function RegistrationForm({
  record,
  professions,
  disabled,
  onSave,
}: {
  record: Registration;
  professions: Profession[];
  disabled: boolean;
  onSave: (changes: RegistrationChanges) => Promise<void>;
}) {
  const [choices, setChoices] = useState<ProfessionChoice[]>(
    record.tipo === 'profissional' ? record.dados.profissoes : [],
  );
  const [courses, setCourses] = useState<Course[]>(
    record.tipo === 'profissional' ? record.dados.cursos : [],
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const optional = (name: string) => text(name) || null;
    const address: Address = {
      cidade: text('cidade'),
      uf: text('uf'),
      cep: optional('cep'),
      rua: optional('rua'),
      numero: optional('numero'),
      complemento: optional('complemento'),
      bairro: optional('bairro'),
    };
    const common = { whatsapp: text('whatsapp'), email: optional('email'), endereco: address };
    if (record.tipo === 'profissional')
      await onSave({
        tipo: 'profissional',
        alteracoes: {
          ...common,
          nome: text('nome'),
          cpf: text('cpf'),
          nascimento: optional('nascimento'),
          biografia: text('biografia'),
          profissoes: choices,
          cursos: courses,
        },
      });
    else
      await onSave({
        tipo: 'empresa',
        alteracoes: {
          ...common,
          razao_social: text('razao_social'),
          nome_fantasia: optional('nome_fantasia'),
          cnpj: text('cnpj'),
          responsavel: text('responsavel'),
          segmento: text('segmento'),
          descricao: optional('descricao'),
        },
      });
  }
  function field(
    name: string,
    label: string,
    value: string | null,
    required = false,
    maxLength = 150,
    type = 'text',
    minLength?: number,
  ) {
    return (
      <label key={name}>
        {label}
        {required ? ' *' : ''}
        <input
          className="field mt-1"
          name={name}
          defaultValue={value ?? ''}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          type={type}
        />
      </label>
    );
  }
  function courseChange(
    index: number,
    key: 'nome' | 'instituicao' | 'inicio' | 'conclusao',
    value: string,
  ) {
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
  return (
    <form onSubmit={(event) => void save(event)} className="panel space-y-6 p-5 sm:p-7">
      <h2 className="text-xl font-bold text-brand-500">Dados do cadastro</h2>
      <p className="text-sm text-gray-600">
        * Campos obrigatórios. Contatos, documentos e endereço completo ficam privados.
      </p>
      <fieldset disabled={disabled} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {record.tipo === 'profissional' ? (
            <>
              {field('nome', 'Nome completo', record.dados.nome, true, 150, 'text', 3)}
              {field('cpf', 'CPF (11 dígitos)', record.dados.cpf, true, 11)}
              {field('nascimento', 'Nascimento', record.dados.nascimento, false, 10, 'date')}
            </>
          ) : (
            <>
              {field(
                'razao_social',
                'Razão social',
                record.dados.razao_social,
                true,
                200,
                'text',
                3,
              )}
              {field('nome_fantasia', 'Nome fantasia', record.dados.nome_fantasia, false, 200)}
              {field('cnpj', 'CNPJ (14 posições)', record.dados.cnpj, true, 14)}
              {field('responsavel', 'Responsável', record.dados.responsavel, true, 150, 'text', 3)}
              {field('segmento', 'Segmento', record.dados.segmento, true)}
            </>
          )}
          {field('whatsapp', 'WhatsApp (+55 e DDD)', record.dados.whatsapp, true, 14, 'tel')}
          {field('email', 'E-mail', record.dados.email, false, 254, 'email')}
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-bold text-brand-500">Localização</legend>
          {addressFields.map((item) =>
            field(
              item.name,
              item.label,
              record.dados.endereco[item.name],
              item.name === 'cidade',
              item.max,
            ),
          )}
          <label>
            UF *
            <select
              className="field mt-1"
              name="uf"
              required
              defaultValue={record.dados.endereco.uf}
            >
              {states.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </label>
        </fieldset>
        {record.tipo === 'profissional' ? (
          <>
            <label className="block">
              Biografia *
              <textarea
                className="field mt-1 min-h-28"
                name="biografia"
                required
                minLength={20}
                maxLength={400}
                defaultValue={record.dados.biografia}
              />
            </label>
            <fieldset className="space-y-3">
              <legend className="mb-2 font-bold text-brand-500">Profissões (1 a 5)</legend>
              <p className="text-sm text-gray-600">
                Escolha uma principal. Substitua as sugestões por profissões oficiais antes de
                aprovar. Novas profissões podem ser criadas na aba Profissões.
              </p>
              {choices.map((choice, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label>
                      Profissão {index + 1}
                      <select
                        className="field mt-1"
                        aria-label={`Profissão ${index + 1}`}
                        value={'profissao_id' in choice ? choice.profissao_id : 'outra'}
                        required
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
                        {professions.map((profession) => (
                          <option
                            key={profession.id}
                            value={profession.id}
                            disabled={
                              !profession.ativo &&
                              !('profissao_id' in choice && choice.profissao_id === profession.id)
                            }
                          >
                            {profession.nome}
                            {profession.ativo ? '' : ' (inativa)'}
                          </option>
                        ))}
                        <option value="outra">Outra / sugestão</option>
                      </select>
                    </label>
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
                      disabled={choices.length === 1}
                      onClick={() =>
                        setChoices((items) => {
                          const remaining = items.filter((_, position) => position !== index);
                          return choice.principal
                            ? remaining.map((item, position) => ({
                                ...item,
                                principal: position === 0,
                              }))
                            : remaining;
                        })
                      }
                    >
                      Remover profissão {index + 1}
                    </button>
                  </div>
                  {'sugestao' in choice && (
                    <label className="mt-3 block">
                      Sugestão {index + 1}
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
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline"
                disabled={choices.length >= 5}
                onClick={() =>
                  setChoices((items) => [...items, { sugestao: '', principal: false }])
                }
              >
                Adicionar profissão
              </button>
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="mb-2 font-bold text-brand-500">Cursos (até 10)</legend>
              {courses.map((course, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2"
                >
                  <label>
                    Nome do curso {index + 1}
                    <input
                      className="field mt-1"
                      required
                      maxLength={150}
                      value={course.nome}
                      onChange={(event) => courseChange(index, 'nome', event.target.value)}
                    />
                  </label>
                  <label>
                    Instituição {index + 1}
                    <input
                      className="field mt-1"
                      maxLength={150}
                      value={course.instituicao ?? ''}
                      onChange={(event) => courseChange(index, 'instituicao', event.target.value)}
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
                        onChange={(event) => courseChange(index, key, event.target.value)}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      setCourses((items) => items.filter((_, position) => position !== index))
                    }
                  >
                    Remover curso {index + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline"
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
            <textarea
              className="field mt-1 min-h-28"
              name="descricao"
              maxLength={1000}
              defaultValue={record.dados.descricao ?? ''}
            />
          </label>
        )}
        <button className="btn btn-primary" type="submit">
          Salvar alterações
        </button>
      </fieldset>
    </form>
  );
}
