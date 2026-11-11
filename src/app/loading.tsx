export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-7xl px-4 py-12">
      <span className="sr-only">Carregando página…</span>
      <div className="skeleton mb-6 h-12 w-2/3" />
      <div className="skeleton h-80 w-full" />
    </div>
  );
}
