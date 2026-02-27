import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInvestorDashboardData } from "@/lib/investorDashboard";
import styles from "./investorDashboard.module.css";
import InvestorDashboardClient from "./InvestorDashboardClient";
import InvestorHeaderViewModeToggle from "./InvestorHeaderViewModeToggle";

export default async function InvestorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=%2Finvestor%2Fdashboard");
  }

  const result = await getInvestorDashboardData();

  if (result.ok === false) {
    if (result.reason === "not_logged_in") {
      redirect("/login?redirect=%2Finvestor%2Fdashboard");
    }
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Area Investitore</h1>
          <p className={styles.subtitle}>Le tue campagne attive</p>
        </header>
        <div className={styles.toggleRow}>
          <InvestorHeaderViewModeToggle />
        </div>
        <div className={styles.unauthorizedBox}>
          <h2 className={styles.unauthorizedTitle}>Accesso non autorizzato</h2>
          <p className={styles.unauthorizedText}>{result.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Area Investitore</h1>
        <p className={styles.subtitle}>Le tue campagne attive</p>
      </header>
      <div className={styles.toggleRow}>
        <InvestorHeaderViewModeToggle />
      </div>

      <InvestorDashboardClient cards={result.cards} />
    </div>
  );
}
