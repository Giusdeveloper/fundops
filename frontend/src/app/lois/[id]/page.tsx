import { createClient } from "@/lib/supabase/server";
import LoiDetailClient from "./LoiDetailClient";
import styles from "../loi.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LoiDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!id?.trim()) {
    return (
      <div className={styles["loi-not-found"]}>
        <h1>LOI non trovata</h1>
        <p>ID mancante o non valido.</p>
      </div>
    );
  }

  const supabaseAuth = await createClient();

  const { data: loi, error: loiError } = await supabaseAuth
    .from("fundops_lois")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loiError) {
    console.error("[LoiDetailPage] Error fetching LOI:", loiError);
    return (
      <div className={styles["loi-not-found"]}>
        <h1>LOI non trovata</h1>
        <p>Errore nel caricamento.</p>
      </div>
    );
  }

  if (!loi) {
    return (
      <div className={styles["loi-not-found"]}>
        <h1>LOI non trovata</h1>
        <p>Nessuna LOI con questo ID.</p>
      </div>
    );
  }

  let investor = null;
  if (loi.investor_id) {
    const { data } = await supabaseAuth
      .from("fundops_investors")
      .select("*")
      .eq("id", loi.investor_id)
      .maybeSingle();
    investor = data;
  }

  let company = null;
  if (loi.company_id) {
    const { data } = await supabaseAuth
      .from("fundops_companies")
      .select("*")
      .eq("id", loi.company_id)
      .maybeSingle();
    company = data;
  }

  return (
    <LoiDetailClient
      loi={loi}
      investor={investor}
      company={company}
    />
  );
}
