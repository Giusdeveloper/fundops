"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import styles from "./account.module.css";

interface AccountProfileFormProps {
  section: "profile" | "preferences" | "security";
  initialFullName: string;
  email: string;
  avatarUrl: string | null;
  roleLabel: string;
  areaLabel: string;
  initialViewMode: "startup" | "investor";
  canSwitchViewMode: boolean;
}

export default function AccountProfileForm({
  section,
  initialFullName,
  email,
  avatarUrl,
  roleLabel,
  areaLabel,
  initialViewMode,
  canSwitchViewMode,
}: AccountProfileFormProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [emailValue, setEmailValue] = useState(email);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [viewMode, setViewMode] = useState<"startup" | "investor">(initialViewMode);
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      setAvatarZoom(1);
      setAvatarOffsetX(0);
      setAvatarOffsetY(0);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);
    setAvatarZoom(1);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [avatarFile]);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingProfile) return;

    try {
      setSavingProfile(true);

      const [profileResponse, viewModeResponse] = await Promise.all([
        fetch("/api/account/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName }),
        }),
        fetch("/api/profile/view-mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ view_mode: viewMode }),
        }),
      ]);

      const profilePayload = (await profileResponse.json().catch(() => null)) as
        | { error?: string; fullName?: string }
        | null;
      const viewModePayload = (await viewModeResponse.json().catch(() => null)) as
        | { error?: string; view_mode?: "startup" | "investor"; message?: string }
        | null;

      if (!profileResponse.ok) {
        throw new Error(profilePayload?.error || "Errore aggiornamento profilo");
      }

      if (!viewModeResponse.ok) {
        throw new Error(viewModePayload?.error || "Errore aggiornamento vista");
      }

      if (profilePayload?.fullName) {
        setFullName(profilePayload.fullName);
      }

      if (viewModePayload?.view_mode) {
        setViewMode(viewModePayload.view_mode);
      }

      router.refresh();
      showToast("Profilo aggiornato", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Errore aggiornamento profilo",
        "error"
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingEmail) return;

    const trimmedEmail = emailValue.trim();
    if (!isValidEmail(trimmedEmail)) {
      showToast("Email non valida", "error");
      return;
    }

    try {
      setSavingEmail(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (error) throw error;
      showToast("Richiesta cambio email inviata. Controlla la casella di posta.", "success");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Errore aggiornamento email",
        "error"
      );
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingPassword) return;

    try {
      setSavingPassword(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      showToast("Password aggiornata", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Errore aggiornamento password",
        "error"
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploadingAvatar || !avatarFile) return;

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append("file", await buildCroppedAvatarFile(avatarFile, avatarZoom, avatarOffsetX, avatarOffsetY));

      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; avatarUrl?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Errore upload foto profilo");
      }

      setCurrentAvatarUrl(payload?.avatarUrl ?? null);
      setAvatarFile(null);
      router.refresh();
      showToast("Foto profilo aggiornata", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Errore upload foto profilo",
        "error"
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  async function buildCroppedAvatarFile(
    file: File,
    zoom: number,
    offsetX: number,
    offsetY: number
  ): Promise<File> {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      const size = 512;
      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Editor immagine non disponibile");
      }

      const baseScale = Math.max(size / image.width, size / image.height);
      const drawScale = baseScale * zoom;
      const drawWidth = image.width * drawScale;
      const drawHeight = image.height * drawScale;
      const maxOffsetX = Math.max(0, (drawWidth - size) / 2);
      const maxOffsetY = Math.max(0, (drawHeight - size) / 2);
      const translateX = -maxOffsetX * offsetX;
      const translateY = -maxOffsetY * offsetY;
      const originX = (size - drawWidth) / 2 + translateX;
      const originY = (size - drawHeight) / 2 + translateY;

      context.clearRect(0, 0, size, size);
      context.drawImage(image, originX, originY, drawWidth, drawHeight);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });

      if (!blob) {
        throw new Error("Errore elaborazione immagine");
      }

      const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      return new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Impossibile leggere l'immagine selezionata"));
      image.src = src;
    });
  }

  return (
    <article className={styles.card}>
      {section === "profile" && (
        <>
          <p className={styles.cardLabel}>Profilo</p>
          <form className={styles.formSection} onSubmit={handleAvatarSubmit}>
            <p className={styles.sectionTitle}>Foto profilo</p>
            <div className={styles.avatarSection}>
              {avatarPreviewUrl ? (
                <div className={styles.avatarEditor}>
                  <div className={styles.avatarCropFrame}>
                    <div
                      className={styles.avatarCropPreview}
                      style={{
                        backgroundImage: `url(${avatarPreviewUrl})`,
                        backgroundSize: `${avatarZoom * 100}%`,
                        backgroundPosition: `${50 + avatarOffsetX * 25}% ${50 + avatarOffsetY * 25}%`,
                      }}
                    />
                  </div>
                  <div className={styles.avatarEditorControls}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Zoom</span>
                      <input
                        type="range"
                        min="1"
                        max="2.4"
                        step="0.05"
                        value={avatarZoom}
                        className={styles.rangeInput}
                        onChange={(event) => setAvatarZoom(Number(event.target.value))}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Spostamento orizzontale</span>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={avatarOffsetX}
                        className={styles.rangeInput}
                        onChange={(event) => setAvatarOffsetX(Number(event.target.value))}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Spostamento verticale</span>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={avatarOffsetY}
                        className={styles.rangeInput}
                        onChange={(event) => setAvatarOffsetY(Number(event.target.value))}
                      />
                    </label>
                  </div>
                </div>
              ) : currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt="Foto profilo"
                  className={styles.profileAvatarImage}
                />
              ) : (
                <div className={styles.profileAvatarFallback} aria-hidden="true">
                  {fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <div className={styles.avatarUploadMeta}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Carica immagine</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className={styles.input}
                    onChange={(event) =>
                      setAvatarFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <span className={styles.fieldHint}>
                    Formati supportati: JPG, PNG, WebP, GIF. Dimensione massima 5MB.
                  </span>
                </label>
                <div className={styles.formActions}>
                  <button
                    type="submit"
                    className={styles.secondaryButton}
                    disabled={uploadingAvatar || !avatarFile}
                  >
                    {uploadingAvatar ? "Caricamento..." : "Aggiorna foto"}
                  </button>
                  {avatarPreviewUrl && (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setAvatarFile(null)}
                    >
                      Annulla modifica
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
          <form className={styles.form} onSubmit={handleProfileSubmit}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nome profilo</span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={styles.input}
                placeholder="Nome e cognome"
              />
            </label>

            <div className={styles.readOnlyGrid}>
              <div className={styles.readOnlyCard}>
                <span className={styles.readOnlyLabel}>Email</span>
                <span className={styles.readOnlyValue}>{email}</span>
              </div>
              <div className={styles.readOnlyCard}>
                <span className={styles.readOnlyLabel}>Ruolo</span>
                <span className={styles.readOnlyValue}>{roleLabel}</span>
              </div>
              <div className={styles.readOnlyCard}>
                <span className={styles.readOnlyLabel}>Vista</span>
                <span className={styles.readOnlyValue}>{areaLabel}</span>
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={savingProfile}
              >
                {savingProfile ? "Salvataggio..." : "Salva profilo"}
              </button>
            </div>
          </form>
        </>
      )}

      {section === "preferences" && (
        <>
          <p className={styles.cardLabel}>Preferenze</p>
          <form className={styles.form} onSubmit={handleProfileSubmit}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Vista attiva</span>
              <select
                value={viewMode}
                onChange={(event) =>
                  setViewMode(event.target.value as "startup" | "investor")
                }
                className={styles.input}
                disabled={!canSwitchViewMode}
              >
                <option value="startup">Vista Startup</option>
                <option value="investor">Vista Supporter</option>
              </select>
              <span className={styles.fieldHint}>
                {canSwitchViewMode
                  ? "Puoi scegliere quale area aprire di default."
                  : `${roleLabel}: la vista resta fissata su ${areaLabel}.`}
              </span>
            </label>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={savingProfile}
              >
                {savingProfile ? "Salvataggio..." : "Salva preferenze"}
              </button>
            </div>
          </form>
        </>
      )}

      {section === "security" && (
        <>
          <p className={styles.cardLabel}>Sicurezza</p>
          <form className={styles.formSection} onSubmit={handleEmailSubmit}>
            <p className={styles.sectionTitle}>Email di accesso</p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nuova email</span>
              <input
                type="email"
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                className={styles.input}
                placeholder="nome@azienda.com"
              />
              <span className={styles.fieldHint}>
                Supabase potrebbe richiedere conferma via email prima di applicare il cambio.
              </span>
            </label>
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.secondaryButton}
                disabled={savingEmail}
              >
                {savingEmail ? "Aggiornamento..." : "Aggiorna email"}
              </button>
            </div>
          </form>

          <form className={styles.formSection} onSubmit={handlePasswordSubmit}>
            <p className={styles.sectionTitle}>Password</p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nuova password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={styles.input}
                placeholder="Inserisci una nuova password"
              />
              <span className={styles.fieldHint}>
                Usa una password lunga e distinta da quelle gia usate.
              </span>
            </label>
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.secondaryButton}
                disabled={savingPassword || newPassword.trim().length < 8}
              >
                {savingPassword ? "Aggiornamento..." : "Aggiorna password"}
              </button>
            </div>
          </form>
        </>
      )}
    </article>
  );
}
