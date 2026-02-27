import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLatestReceiptDocumentId } from "@/lib/investorHelpers";
import { ArrowRight } from "lucide-react";
import styles from "../investor.module.css";
import AttestationLink from "./AttestationLink";

export default async function InvestorWelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const receiptDocId = await getLatestReceiptDocumentId();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Benvenuto</h1>
        <p className={styles.subtitle}>
          La tua prenotazione è registrata.
        </p>
      </header>

      <div className={styles.statusBox}>
        La tua lettera d&apos;intenti è stata firmata correttamente. Puoi accedere
        alla dashboard per vedere le campagne associate e i prossimi passi.
      </div>

      <Link href="/investor/dashboard" className={styles.ctaPrimary}>
        Vai alla dashboard
        <ArrowRight size={18} />
      </Link>

      <div className={styles.stepsBox}>
        <h2 className={styles.stepsTitle}>Prossimi passi</h2>
        <ul className={styles.stepsList}>
          <li>Riceverai aggiornamenti quando la fase di issuance sarà attiva</li>
          <li>Potrai caricare documenti e completare l&apos;onboarding dal portal</li>
          <li>Consulta la dashboard per lo stato delle tue campagne</li>
        </ul>
      </div>

      {receiptDocId && <AttestationLink documentId={receiptDocId} />}
    </div>
  );
}
