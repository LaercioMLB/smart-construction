'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { adminRepository } from '@/infrastructure/admin';

export function AdminLoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await adminRepository.login(String(data.get('login')), String(data.get('senha')));
      form.reset();
      router.replace('/admin/profissoes');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel mx-auto max-w-md space-y-5" aria-busy={busy}>
      <div>
        <p className="kicker">Área administrativa</p>
        <h1 className="text-3xl font-bold text-brand-500">Entrar</h1>
      </div>
      <p>Acesse sua conta para gerenciar as profissões da Smart Construction.</p>
      <label className="block font-medium">
        Login
        <input
          className="field mt-2 w-full"
          name="login"
          required
          maxLength={150}
          autoComplete="username"
          autoCapitalize="none"
        />
      </label>
      <label className="block font-medium">
        Senha
        <input
          className="field mt-2 w-full"
          name="senha"
          type="password"
          required
          maxLength={256}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      <button className="btn w-full" disabled={busy}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
