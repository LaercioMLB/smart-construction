'use client';

import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import type { Registration, RegistrationFile } from './registration-contracts';

export function RegistrationImages({
  record,
  disabled,
  onUpload,
  onRemove,
}: {
  record: Registration;
  disabled: boolean;
  onUpload: (file: File, purpose: RegistrationFile['finalidade']) => Promise<boolean>;
  onRemove: (file: RegistrationFile) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<string[]>([]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('arquivo');
    const purpose = data.get('finalidade');
    if (
      !(file instanceof File) ||
      !file.size ||
      !['image/jpeg', 'image/png'].includes(file.type) ||
      file.size > 5242880
    ) {
      setError('Selecione uma imagem JPG/PNG de até 5 MiB.');
      return;
    }
    if (purpose !== 'foto_perfil' && purpose !== 'foto_trabalho' && purpose !== 'logo') return;
    if (await onUpload(file, purpose)) form.reset();
  }
  return (
    <section className="panel space-y-4 p-5">
      <h2 className="text-xl font-bold text-brand-500">Imagens privadas</h2>
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {record.arquivos.length === 0 ? (
        <p className="text-gray-600">Nenhuma imagem enviada.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {record.arquivos.map((file) => (
            <li key={file.id}>
              {failed.includes(file.id) ? (
                <p role="alert" className="rounded-lg bg-red-50 p-4">
                  Não foi possível carregar esta imagem. Recarregue o cadastro para tentar
                  novamente.
                </p>
              ) : (
                <Image
                  unoptimized
                  src={file.acesso_path}
                  alt={
                    file.finalidade === 'foto_perfil'
                      ? 'Foto de perfil enviada'
                      : file.finalidade === 'logo'
                        ? 'Logo enviado'
                        : 'Trabalho enviado'
                  }
                  width={320}
                  height={240}
                  onError={() => setFailed((items) => [...items, file.id])}
                  className="h-44 w-full rounded-xl bg-gray-100 object-contain"
                />
              )}
              <p className="my-2 text-sm">
                {file.finalidade === 'foto_perfil'
                  ? 'Foto de perfil'
                  : file.finalidade === 'logo'
                    ? 'Logo'
                    : `Trabalho ${file.ordem + 1}`}{' '}
                · {Math.ceil(file.tamanho_bytes / 1024)} KB · {file.estado}
              </p>
              <button
                className="btn btn-outline"
                disabled={disabled}
                onClick={() => void onRemove(file)}
              >
                Remover imagem
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(event) => void upload(event)}>
        <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-semibold text-brand-500">
            Adicionar ou substituir imagem
          </legend>
          <label>
            Finalidade
            <select className="field mt-1" name="finalidade">
              {record.tipo === 'profissional' ? (
                <>
                  <option value="foto_perfil">Foto de perfil (substituir)</option>
                  <option value="foto_trabalho">Foto de trabalho (adicionar)</option>
                </>
              ) : (
                <option value="logo">Logo (substituir)</option>
              )}
            </select>
          </label>
          <label>
            Imagem JPG/PNG, até 5 MiB
            <input
              className="field mt-1"
              type="file"
              name="arquivo"
              accept="image/jpeg,image/png"
              required
            />
          </label>
          <button className="btn btn-primary sm:col-span-2" type="submit">
            Enviar imagem
          </button>
        </fieldset>
      </form>
    </section>
  );
}
