"use client";

import React, { useEffect, useRef, useState } from "react";
import "./login.css";
import { Eye, EyeOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginPageContent() {
  // Typewriter effect lento, testo su una riga
  const fullText = "Smart Equity – Gestisci il tuo equity in modo intelligente.";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>("login");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "";

  function setRedirectCookie(path: string) {
    const safe = path?.startsWith("/") ? path : `/${path ?? ""}`;
    document.cookie = `fundops_redirect=${encodeURIComponent(safe)}; path=/; samesite=lax`;
  }

  useEffect(() => {
    if (searchParams.get("mode") === "register") setMode("register");
  }, [searchParams]);

  async function handleOAuth(provider: "google" | "azure") {
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectNow =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect") ?? redirectTo
          : redirectTo;
      const roleFromQuery =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("role")
          : null;
      const safeRedirect = redirectNow
        ? redirectNow.startsWith("/")
          ? redirectNow
          : `/${redirectNow}`
        : "";
      if (safeRedirect) {
        setRedirectCookie(safeRedirect);
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (safeRedirect) callbackUrl.searchParams.set("redirect", safeRedirect);
      if (roleFromQuery === "investor" || roleFromQuery === "founder") {
        callbackUrl.searchParams.set("role", roleFromQuery);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            redirect: safeRedirect,
            role: roleFromQuery ?? "",
          },
        },
      });

      if (error) {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage(error.message);
          return;
        }
        setMessage("Registrazione avvenuta! Controlla la tua email per confermare.");
        setMode("login");
        setEmail("");
        setPassword("");
        return;
      }

      // login
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Login effettuato! Benvenuto.");

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

  return (
    <div className="login-page">
      <canvas ref={canvasRef} className="login-network-bg" />
      <div className="login-network-overlay" />
      <div className="login-content-centered">
        <div className="login-typewriter login-typewriter-margin">{displayed}</div>
        <form className="login-form-glass" onSubmit={handleSubmit}>
          <div className="login-sso-row">
            <button
              type="button"
              className="login-sso-btn google"
              tabIndex={0}
              aria-label="Accedi con Google"
              onClick={() => handleOAuth("google")}
              disabled={loading}
            >
              <svg width="22" height="22" viewBox="0 0 48 48" className="login-sso-icon"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.36 1.46 7.82 2.68l5.8-5.8C34.64 3.36 29.74 1 24 1 14.61 1 6.44 6.98 2.69 15.09l6.74 5.23C11.13 14.36 17.02 9.5 24 9.5z"/><path fill="#34A853" d="M46.15 24.5c0-1.64-.15-3.22-.43-4.74H24v9.24h12.44c-.54 2.9-2.18 5.36-4.64 7.04l7.18 5.59C43.98 37.36 46.15 31.36 46.15 24.5z"/><path fill="#FBBC05" d="M9.43 28.32A14.5 14.5 0 0 1 9.5 19.5v-6H2.69A23.98 23.98 0 0 0 0 24c0 3.77.9 7.34 2.69 10.5l6.74-5.23z"/><path fill="#EA4335" d="M24 46c6.48 0 11.92-2.14 15.91-5.82l-7.18-5.59c-2.01 1.35-4.6 2.16-8.73 2.16-6.98 0-12.87-4.86-14.57-11.27l-6.74 5.23C6.44 41.02 14.61 46 24 46z"/></g></svg>
              Google
            </button>
            <button
              type="button"
              className="login-sso-btn outlook"
              tabIndex={0}
              aria-label="Accedi con Microsoft"
              onClick={() => handleOAuth("azure")}
              disabled={loading}
            >
              <svg width="22" height="22" viewBox="0 0 32 32" className="login-sso-icon"><g><rect width="32" height="32" rx="6" fill="#fff"/><rect x="7" y="7" width="8" height="8" fill="#F35325"/><rect x="17" y="7" width="8" height="8" fill="#81BC06"/><rect x="7" y="17" width="8" height="8" fill="#05A6F0"/><rect x="17" y="17" width="8" height="8" fill="#FFBA08"/></g></svg>
              Microsoft
            </button>
          </div>
          <div className="login-divider"><span>oppure</span></div>
          <div className="login-inputs-wrapper">
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
          <a href="#" className="login-forgot">Password dimenticata?</a>
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
