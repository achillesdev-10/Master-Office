/**
 * Layout de la zone d'authentification : centré, sans sidebar,
 * sans le shell d'administration.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
