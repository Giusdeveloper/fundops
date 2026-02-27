import { redirect } from "next/navigation";
import { hasActiveInvestorAccounts } from "@/lib/investorHelpers";

/**
 * Router Investor Area: redirect a dashboard (se ha account attivi) o no-access.
 */
export default async function InvestorPage() {
  const hasAccounts = await hasActiveInvestorAccounts();
  redirect(hasAccounts ? "/investor/dashboard" : "/investor/no-access");
}
