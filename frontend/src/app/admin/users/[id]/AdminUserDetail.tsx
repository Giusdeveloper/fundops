"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import styles from "./userDetail.module.css";

const FLAG_LABELS: Record<string, string> = {
  allow_dashboard: "Dashboard",
  allow_companies: "Companies",
  allow_investors: "Investors",
  allow_lois: "LOI",
  allow_issuance: "Issuance",
  allow_onboarding: "Onboarding",
  allow_invites: "Invites",
  allow_broadcast: "Broadcast",
  allow_admin_panel: "Admin Panel",
};

const ROLE_OPTIONS = [
  { value: "", label: "(nessuno)" },
  { value: "imment_admin", label: "imment_admin" },
  { value: "imment_operator", label: "imment_operator" },
  { value: "investor", label: "investor" },
];

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role_global: string | null;
  is_active: boolean | null;
  disabled_reason: string | null;
}

interface Permissions {
  allow_dashboard?: boolean | null;
  allow_companies?: boolean | null;
  allow_investors?: boolean | null;
  allow_lois?: boolean | null;
  allow_issuance?: boolean | null;
  allow_onboarding?: boolean | null;
  allow_invites?: boolean | null;
  allow_broadcast?: boolean | null;
  allow_admin_panel?: boolean | null;
}

interface Seat {
  id: string;
  company_id: string;
  company_name: string;
  is_active: boolean;
  disabled_reason?: string | null;
}

interface InvestorAccount {
  id: string;
  investor_id: string;
  company_id: string;
  company_name: string;
  investor_name: string;
  lifecycle_stage: string;
  is_active: boolean;
  disabled_reason?: string | null;
}

interface UserDetailData {
  profile: Profile;
  permissions: Permissions | null;
  seats: Seat[];
  investor_accounts: InvestorAccount[];
  current_user_id?: string;
}

type FlagKey = keyof Permissions & keyof typeof FLAG_LABELS;

export default function AdminUserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [disabledReason, setDisabledReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) {
        if (res.status === 403) {
          showToast("Accesso non autorizzato", "error");
          router.push("/admin");
          return;
        }
        if (res.status === 404) {
          showToast("Utente non trovato", "error");
          router.push("/admin");
          return;
        }
        throw new Error("Errore caricamento");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, router, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data?.profile?.disabled_reason) {
      setDisabledReason(data.profile.disabled_reason);
    }
  }, [data?.profile?.disabled_reason]);

  const handleProfileUpdate = async (updates: Partial<Profile> & { disabled_reason?: string }) => {
    setSaving("profile");
    try {
      if (updates.is_active === false && disabledReason) {
        (updates as Record<string, unknown>).disabled_reason = disabledReason;
      }
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Errore aggiornamento");
      }
      setData((prev) => prev ? { ...prev, profile: json } : null);
      showToast("Profilo aggiornato", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore", "error");
    } finally {
      setSaving(null);
    }
  };

  const handlePermissionsUpdate = async (flagUpdates: Record<string, boolean | null>) => {
    setSaving("permissions");
    try {
      const merged = { ...permissions, ...flagUpdates };
      const res = await fetch(`/api/admin/permissions/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore");
      setData((prev) =>
        prev ? { ...prev, permissions: json } : null
      );
      showToast("Permessi aggiornati", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleSeatToggle = async (seat: Seat) => {
    setSaving(seat.id);
    try {
      const res = await fetch(`/api/admin/company-users/${seat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !seat.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore");
      setData((prev) =>
        prev
          ? {
              ...prev,
              seats: prev.seats.map((s) =>
                s.id === seat.id ? { ...s, is_active: !s.is_active } : s
              ),
            }
          : null
      );
      showToast(seat.is_active ? "Seat disabilitata" : "Seat attivata", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleInvestorAccountToggle = async (acc: InvestorAccount) => {
    setSaving(acc.id);
    try {
      const res = await fetch(`/api/admin/investor-accounts/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !acc.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore");
      setData((prev) =>
        prev
          ? {
              ...prev,
              investor_accounts: prev.investor_accounts.map((a) =>
                a.id === acc.id ? { ...a, is_active: !a.is_active } : a
              ),
            }
          : null
      );
      showToast(acc.is_active ? "Account disabilitato" : "Account attivato", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore", "error");
    } finally {
      setSaving(null);
    }
  };

  if (loading || !data) {
    return <p className={styles.loading}>Caricamento…</p>;
  }

  const { profile, permissions, seats, investor_accounts, current_user_id } = data;
  const isSelf = current_user_id ? profile.id === current_user_id : false;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin" className={styles.backLink}>
          ← Lista utenti
        </Link>
        <h1 className={styles.title}>
          {profile.email ?? "(missing email)"}
        </h1>
      </div>

      {/* Sezione 1: Account */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.card}>
          <div className={styles.field}>
            <label>Email</label>
            <span className={styles.readOnly}>{profile.email ?? "(missing email)"}</span>
          </div>
          <div className={styles.field}>
            <label>Nome completo</label>
            <span className={styles.readOnly}>{profile.full_name ?? "—"}</span>
          </div>
          <div className={styles.field}>
            <label>User ID</label>
            <span className={styles.readOnlyMono}>{profile.id}</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="user-role-select">Ruolo</label>
            <select
              id="user-role-select"
              value={profile.role_global ?? ""}
              onChange={(e) =>
                handleProfileUpdate({
                  role_global: e.target.value || null,
                })
              }
              disabled={saving === "profile"}
              className={styles.select}
              aria-label="Ruolo utente"
              title="Ruolo utente"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Stato</label>
            <div className={styles.toggleRow}>
              <span
                className={`${styles.badge} ${
                  profile.is_active ? styles.badgeActive : styles.badgeInactive
                }`}
              >
                {profile.is_active ? "Attivo" : "Disabilitato"}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleProfileUpdate({ is_active: !(profile.is_active ?? true) })
                }
                disabled={saving === "profile" || (isSelf && (profile.is_active ?? false))}
                className={styles.toggleBtn}
                title={
                  isSelf && (profile.is_active ?? false)
                    ? "Non puoi disattivare il tuo account"
                    : undefined
                }
              >
                {saving === "profile"
                  ? "..."
                  : profile.is_active
                  ? "Disabilita"
                  : "Attiva"}
              </button>
            </div>
          </div>

          {!(profile.is_active ?? true) && (
            <div className={styles.field}>
              <label>Motivo disabilitazione</label>
              <input
                type="text"
                value={disabledReason}
                onChange={(e) => setDisabledReason(e.target.value)}
                onBlur={() => {
                  if (disabledReason !== (profile.disabled_reason ?? "")) {
                    handleProfileUpdate({ disabled_reason: disabledReason || undefined });
                  }
                }}
                placeholder="Opzionale"
                className={styles.input}
              />
            </div>
          )}
        </div>
      </section>

      {/* Sezione 2: Feature flags */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Feature flags</h2>
        <div className={styles.card}>
          <div className={styles.flagGrid}>
            {(Object.keys(FLAG_LABELS) as FlagKey[]).map(
              (key) => {
                const val = permissions?.[key] ?? null;
                return (
                  <div key={key} className={styles.flagRow}>
                    <label htmlFor={`flag-${key}`} className={styles.flagLabel}>
                      {FLAG_LABELS[key]}
                    </label>
                    <select
                      id={`flag-${key}`}
                      value={val === null ? "inherit" : val ? "allow" : "deny"}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePermissionsUpdate({
                          [key]:
                            v === "inherit" ? null : v === "allow",
                        });
                      }}
                      disabled={saving === "permissions"}
                      className={styles.flagSelect}
                      aria-label={FLAG_LABELS[key]}
                      title={FLAG_LABELS[key]}
                    >
                      <option value="inherit">Inherit</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </section>

      {/* Sezione 3: Seats */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Seats</h2>
        <div className={styles.card}>
          {seats.length === 0 ? (
            <p className={styles.empty}>Nessun seat assegnato.</p>
          ) : (
            <ul className={styles.list}>
              {seats.map((seat) => (
                <li key={seat.id} className={styles.listItem}>
                  <span className={styles.listMain}>{seat.company_name}</span>
                  <span
                    className={`${styles.badge} ${
                      seat.is_active ? styles.badgeActive : styles.badgeInactive
                    }`}
                  >
                    {seat.is_active ? "Attivo" : "Disabilitato"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSeatToggle(seat)}
                    disabled={saving === seat.id}
                    className={styles.toggleBtn}
                  >
                    {saving === seat.id ? "..." : seat.is_active ? "Disabilita" : "Attiva"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Sezione 4: Investor accounts */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Investor accounts</h2>
        <div className={styles.card}>
          {investor_accounts.length === 0 ? (
            <p className={styles.empty}>Nessun account investitore.</p>
          ) : (
            <ul className={styles.list}>
              {investor_accounts.map((acc) => (
                <li key={acc.id} className={styles.listItem}>
                  <span className={styles.listMain}>
                    {acc.investor_name} · {acc.company_name}
                  </span>
                  <span className={styles.listSub}>
                    {acc.lifecycle_stage}
                  </span>
                  <span
                    className={`${styles.badge} ${
                      acc.is_active ? styles.badgeActive : styles.badgeInactive
                    }`}
                  >
                    {acc.is_active ? "Attivo" : "Disabilitato"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleInvestorAccountToggle(acc)}
                    disabled={saving === acc.id}
                    className={styles.toggleBtn}
                  >
                    {saving === acc.id
                      ? "..."
                      : acc.is_active
                      ? "Disabilita"
                      : "Attiva"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
