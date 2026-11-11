import icons from '@/shared/icons.json';
export function Icon({
  name,
  className = '',
  size = 24,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const key = name.replace(/^mdi[:-]/, '');
  const body = (icons as Record<string, string>)[key] ?? icons.hammer;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
