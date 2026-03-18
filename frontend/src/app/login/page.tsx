"use client";

import React, { useEffect, useRef, useState } from "react";
import "./login.css";
import { Eye, EyeOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function LoginPageContent() {
  // Typewriter effect lento, testo su una riga
  const fullText = "FundOps – Gestisci Booking, Issuance e Onboarding in un unico flusso.";
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 65);
    return () => clearInterval(interval);
  }, []);

  // Canvas network effect: nodi con connessioni fisse (rete neurale)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    const N = 22;
    // eslint-disable-next-line prefer-const
    let nodes = Array.from({ length: N }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7
    }));
    // Connessioni fisse: ogni nodo collegato ai 2-3 successivi (ciclo)
    const edges: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      edges.push([i, (i + 1) % N]);
      edges.push([i, (i + 2) % N]);
      if (i % 3 === 0) edges.push([i, (i + 3) % N]);
    }
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      // Disegno le connessioni fisse (rete neurale)
      for (const [aIdx, bIdx] of edges) {
        const a = nodes[aIdx], b = nodes[bIdx];
        ctx.strokeStyle = "rgba(59,130,246,0.28)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Linee dinamiche tra nodi vicini
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.strokeStyle = "rgba(59,130,246,0.10)";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // Draw nodes
      const nodeRadius = width > 900 ? 5.5 : 4;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, nodeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = "#22d3ee";
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    function animate() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        // Rimbalzo ai bordi
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
        // Piccolo random walk
        n.vx += (Math.random() - 0.5) * 0.04;
        n.vy += (Math.random() - 0.5) * 0.04;
        n.vx = Math.max(-0.7, Math.min(0.7, n.vx));
        n.vy = Math.max(-0.7, Math.min(0.7, n.vy));
      }
      draw();
      requestAnimationFrame(animate);
    }
    animate();
    // Resize
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>("login");
  const [registerRole, setRegisterRole] = useState<"founder" | "investor">("founder");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "";

  useEffect(() => {
    if (searchParams.get("mode") === "register") setMode("register");
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setMessage("Email non valida");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      if (mode === "register") {
        if (!fullName.trim()) {
          setMessage("Inserisci nome e cognome");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { pending_role: registerRole, full_name: fullName.trim() } },
        });
        if (error) {
          setMessage(error.message);
          return;
        }
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem("fundops_pending_role", registerRole);
          }
        } catch {
          // no-op: localStorage not available
        }
        setMessage("Registrazione avvenuta! Controlla la tua email per confermare.");
        setMode("login");
        setFullName("");
        setEmail("");
        setPassword("");
        return;
      }

      // login
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Login effettuato! Benvenuto.");

      // Se l'utente ha scelto un ruolo in fase di registrazione, lo applichiamo al primo login
      try {
        if (typeof window !== "undefined") {
          const pendingRole = window.localStorage.getItem("fundops_pending_role");
          if (pendingRole === "founder" || pendingRole === "investor") {
            const roleRes = await fetch("/api/profile/view-mode", { cache: "no-store" });
            const roleJson = await roleRes.json().catch(() => null);
            if (roleRes.ok && roleJson?.role_global == null) {
              const setRoleRes = await fetch("/api/auth/set-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: pendingRole }),
              });
              if (setRoleRes.ok) {
                window.localStorage.removeItem("fundops_pending_role");
              }
            } else if (roleRes.ok && roleJson?.role_global) {
              window.localStorage.removeItem("fundops_pending_role");
            }
          }
        }
      } catch {
        // non bloccare il login per il set ruolo
      }

      // 1) se l'URL contiene ?redirect=..., lo rispettiamo (deep link)
      const redirectNow =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect") ?? redirectTo
          : redirectTo;

      if (redirectNow) {
        window.location.href = redirectNow.startsWith("/") ? redirectNow : `/${redirectNow}`;
        return;
      }

      // 2) altrimenti chiediamo al server dove mandare l'utente (role-based)
      try {
        const res = await fetch("/api/auth/home-route", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const homeRoute = json?.homeRoute;

        if (res.ok && typeof homeRoute === "string" && homeRoute.startsWith("/")) {
          window.location.href = homeRoute;
          return;
        }
      } catch {
        // fallback sotto
      }

      // fallback ultimo (solo se API non risponde)
      window.location.href = "/dashboard";
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setMessage(null);

    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setMessage("Inserisci un'email valida per il reset password.");
      return;
    }

    setResetting(true);
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectUrl = origin
        ? `${origin}/auth/callback?redirect=/account`
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Email di reset inviata. Controlla la casella di posta.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="login-page">
      <canvas ref={canvasRef} className="login-network-bg" />
      <div className="login-network-overlay" />
      <div className="login-content-centered">
        <div className="login-typewriter login-typewriter-margin">{displayed}</div>
        <form className="login-form-glass" onSubmit={handleSubmit}>
        <div className="login-divider"><span>accedi</span></div>
          <div className="login-inputs-wrapper">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Nome e cognome"
                autoComplete="name"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            )}
            <input type="email" placeholder="Email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
            <div className="input-password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="login-password-input"
              />
              <span className="input-password-eye" onClick={() => setShowPassword(v => !v)} tabIndex={0} aria-label="Mostra/Nascondi password" role="button">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </span>
            </div>
          </div>
          {mode === "register" && (
            <div className="login-role-select">
              <div className="login-role-label">Sei una startup o un supporter?</div>
              <div className="login-role-buttons" role="group" aria-label="Seleziona il profilo">
                <button
                  type="button"
                  className={`login-role-btn ${registerRole === "founder" ? "active" : ""}`}
                  onClick={() => setRegisterRole("founder")}
                >
                  Startup
                </button>
                <button
                  type="button"
                  className={`login-role-btn ${registerRole === "investor" ? "active" : ""}`}
                  onClick={() => setRegisterRole("investor")}
                >
                  Supporter
                </button>
              </div>
            </div>
          )}
          <a href="#" className="login-forgot" onClick={handlePasswordReset}>
            {resetting ? "Invio reset..." : "Password dimenticata?"}
          </a>
          <button type="submit" disabled={loading}>
            {loading ? "Attendi…" : mode === "register" ? "Registrati" : "Accedi"}
          </button>
          <div className="login-register-link">
            {mode === "register" ? (
              <>Hai già un account? <a href="#" onClick={e => {e.preventDefault(); setMode('login'); setMessage(null);}}>Accedi</a></>
            ) : (
              <>Non hai un account? <a href="#" onClick={e => {e.preventDefault(); setMode('register'); setMessage(null);}}>Registrati</a></>
            )}
          </div>
          {message && <div className={`login-message ${message.includes('successo') ? 'success' : 'error'}`}>{message}</div>}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page" />}>
      <LoginPageContent />
    </Suspense>
  );
}
