"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import styles from "./admin.module.css";

interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  role_global: string | null;
  is_active: boolean | null;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function AdminUsersTable() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const q = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : "";
      const res = await fetch(`/api/admin/users${q}`);
      if (!res.ok) {
        if (res.status === 403) {
          showToast("Accesso non autorizzato", "error");
          return;
        }
        throw new Error("Errore caricamento utenti");
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore caricamento", "error");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleActive = async (user: User) => {
    if (togglingId) return;
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !(user.is_active ?? true) }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore aggiornamento");
      }
      showToast(user.is_active ? "Utente disabilitato" : "Utente attivato", "success");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: !(user.is_active ?? true) } : u
        )
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore", "error");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className={styles.adminContainer}>
      <div className={styles.adminHeader}>
        <h1 className={styles.adminTitle}>Gestione utenti</h1>
        <input
          type="search"
          placeholder="Cerca per email o nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <p className={styles.loading}>Caricamento…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Stato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link href={`/admin/users/${user.id}`} className={styles.userLink}>
                      {user.email ?? "(missing email)"}
                    </Link>
                  </td>
                  <td>
                    <span className={styles.roleBadge}>{user.role_global ?? "—"}</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        user.is_active ? styles.statusActive : styles.statusInactive
                      }`}
                    >
                      {user.is_active ? "Attivo" : "Disabilitato"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user)}
                      disabled={togglingId === user.id}
                      className={styles.toggleBtn}
                      title={user.is_active ? "Disabilita" : "Attiva"}
                    >
                      {togglingId === user.id
                        ? "..."
                        : user.is_active
                        ? "Disabilita"
                        : "Attiva"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && users.length === 0 && (
          <p className={styles.empty}>Nessun utente trovato.</p>
        )}
      </div>
    </div>
  );
}
