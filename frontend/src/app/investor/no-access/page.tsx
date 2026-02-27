import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogOut } from "lucide-react";
import styles from "../investor.module.css";
import LogoutButton from "./LogoutButton";

export default async function InvestorNoAccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Area Investitore</h1>
        <p className={styles.subtitle}>
          Non hai accesso a nessuna campagna
        </p>
      </header>

      <div className={styles.noAccessBox}>
        <h2 className={styles.noAccessTitle}>Accesso non disponibile</h2>
        <p className={styles.noAccessText}>
          Per accedere all&apos;area investitore serve un invito o un&apos;associazione
          a una campagna. Contatta l&apos;azienda che ti ha invitato per ottenere
          l&apos;accesso.
        </p>
        <LogoutButton className={styles.btnLogout}>
          <LogOut size={18} />
          Esci
        </LogoutButton>
      </div>
    </div>
  );
}
