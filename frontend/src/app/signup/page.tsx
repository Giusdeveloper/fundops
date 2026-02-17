"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ValidateResult = {
  valid: boolean;
  expired?: boolean;
  redirect?: string;
  error?: string;
};

/**
 * Pagina signup: accetta token, valida invito, reindirizza a login.
 * - Token assente: redirect a login con mode=register
 * - Token non valido: mostra "Invito non valido"
 * - Token scaduto: mostra "Invito scaduto" e permette comunque di procedere
 * - Token valido: redirect a login
 */
function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const redirectParam = searchParams.get("redirect") ?? "/dashboard";

  const [status, setStatus] = useState<"loading" | "invalid" | "expired" | "valid">("loading");
  const [redirect, setRedirect] = useState(redirectParam);

  useEffect(() => {
    if (!token) {
      const params = new URLSearchParams();
      params.set("mode", "register");
      params.set("redirect", redirectParam);
      router.replace(`/login?${params.toString()}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invites/validate?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirectParam)}`
        );
        const data: ValidateResult = await res.json();

        if (cancelled) return;

        if (!data.valid) {
          setStatus("invalid");
          return;
        }

        if (data.expired) {
          setStatus("expired");
          setRedirect(data.redirect ?? redirectParam);
          return;
        }

        setStatus("valid");
        const params = new URLSearchParams();
        params.set("mode", "register");
        params.set("redirect", data.redirect ?? redirectParam);
        router.replace(`/login?${params.toString()}`);
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();

    return () => { cancelled = true; };
  }, [token, redirectParam, router]);

  const goToLogin = () => {
    const params = new URLSearchParams();
    params.set("mode", "register");
    params.set("redirect", redirect);
    router.push(`/login?${params.toString()}`);
  };

  if (status === "loading") {
    return (
      <div className="signup-page">
        <div className="signup-card">
          <p className="signup-text">Verifica invito in corso…</p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="signup-page">
        <div className="signup-card signup-error">
          <h1 className="signup-title">Invito non valido</h1>
          <p className="signup-text">
            Il link di invito non è corretto o è già stato utilizzato. Contatta chi ti ha invitato per ricevere un nuovo link.
          </p>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="signup-page">
        <div className="signup-card signup-warning">
          <h1 className="signup-title">Invito scaduto</h1>
          <p className="signup-text">
            Il link di invito è scaduto (valido 7 giorni). Puoi comunque creare un account e accedere se hai già un invito attivo per questa società.
          </p>
          <button type="button" className="signup-button" onClick={goToLogin}>
            Procedi alla registrazione
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <p className="signup-text">Reindirizzamento alla registrazione…</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="signup-page">
          <div className="signup-card">
            <p className="signup-text">Verifica invito in corso…</p>
          </div>
        </div>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
