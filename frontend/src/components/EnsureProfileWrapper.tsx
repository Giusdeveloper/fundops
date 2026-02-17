import { ensureProfile } from "@/lib/ensureProfile";

/**
 * Server Component: garantisce che l'utente autenticato abbia un profilo.
 * Chiamato su ogni richiesta; se utente non loggato, ensureProfile fa no-op.
 */
export default async function EnsureProfileWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureProfile();
  return <>{children}</>;
}
