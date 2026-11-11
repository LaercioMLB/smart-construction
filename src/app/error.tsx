'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="title-section">Não foi possível carregar a página</h1>
      <p className="mb-6">Tente novamente para continuar.</p>
      <button className="btn" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
