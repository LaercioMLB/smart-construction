'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { validateFiles } from './repository';
export function FilePicker({
  label,
  max,
  onChange,
}: {
  label: string;
  max: number;
  onChange: (files: File[]) => void;
}) {
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState('');
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const current = urls.current;
    return () => current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const update = (selected: File[]) => {
    const next = [...files.map((item) => item.file), ...selected];
    const invalid = validateFiles(next, max);
    if (invalid) {
      setError(invalid);
      return;
    }
    const nextFiles = [
      ...files,
      ...selected.map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { file, url };
      }),
    ];
    setFiles(nextFiles);
    setError('');
    onChange(next);
  };
  return (
    <section>
      <h3 className="field-label">{label}</h3>
      <p className="mb-3 text-sm text-gray-500">
        JPG ou PNG até 5 MB. No máximo {max} {max === 1 ? 'foto' : 'fotos'}. Arquivos ficam somente
        nesta sessão.
      </p>
      <div className="mb-4 flex flex-wrap gap-3">
        {files.map((item, index) => (
          <div className="relative size-24" key={item.url}>
            <Image
              src={item.url}
              alt={`${label} ${index + 1}`}
              width={96}
              height={96}
              unoptimized
              className="h-full w-full rounded-xl object-cover"
            />
            <button
              type="button"
              aria-label={`Remover ${label.toLowerCase()} ${index + 1}`}
              className="absolute -top-2 -right-2 rounded-full bg-white p-1 text-red-600 shadow"
              onClick={() => {
                URL.revokeObjectURL(item.url);
                urls.current.delete(item.url);
                const next = files.filter((_, n) => n !== index);
                setFiles(next);
                onChange(next.map((value) => value.file));
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {files.length < max && (
        <label className="btn btn-outline cursor-pointer">
          <Upload size={18} />
          {label === 'Foto de perfil' ? 'Selecionar foto' : 'Adicionar fotos'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            multiple={max > 1}
            aria-label={label}
            className="sr-only"
            onChange={(event) => {
              update(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
        </label>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
