/**
 * Aperçu visuel d’un thème (module 11) — image `previewUrl` si
 * présente, sinon dégradé déterministe généré à partir du slug.
 */

const PREVIEW_GRADIENTS = [
  "from-violet-500 via-fuchsia-500 to-pink-500",
  "from-sky-500 via-cyan-500 to-teal-500",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-emerald-500 via-green-500 to-lime-500",
  "from-indigo-500 via-blue-500 to-sky-500",
  "from-rose-500 via-red-500 to-orange-500",
];

export function themeGradient(slug: string): string {
  let hash = 0;
  for (const char of slug) hash = (hash + char.charCodeAt(0)) % 1000;
  const index = hash % PREVIEW_GRADIENTS.length;
  return PREVIEW_GRADIENTS[index] ?? PREVIEW_GRADIENTS[0] ?? "";
}

export function ThemePreview({
  theme,
  className = "h-40",
}: {
  theme: { name: string; slug: string; previewUrl?: string | null };
  className?: string;
}) {
  if (theme.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={theme.previewUrl}
        alt={`Aperçu du thème ${theme.name}`}
        className={`${className} w-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex w-full items-center justify-center bg-gradient-to-br ${themeGradient(theme.slug)} ${className}`}
    >
      <span className="rounded-full bg-black/25 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
        {theme.name}
      </span>
    </div>
  );
}
