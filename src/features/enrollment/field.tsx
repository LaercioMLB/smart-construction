'use client';
import type { HTMLInputTypeAttribute } from 'react';
export function Field({
  name,
  label,
  value,
  onChange,
  error,
  optional = false,
  type = 'text',
  inputMode,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  optional?: boolean;
  type?: HTMLInputTypeAttribute;
  inputMode?: 'numeric' | 'tel' | 'email';
  placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
        {optional ? (
          <span className="ml-2 text-xs font-normal text-gray-400">Opcional</span>
        ) : (
          <span className="ml-1 text-accent-600">*</span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="field"
        placeholder={placeholder}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
