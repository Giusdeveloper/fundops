import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPortalContext, type PortalContext } from "@/lib/getPortalContext";
import PortalInvestClient, { type RequiredDocType } from "./PortalInvestClient";
import styles from "../portal.module.css";

const REQUIRED_DOC_TYPES: readonly RequiredDocType[] = [
  "investment_form",
  "bank_transfer_proof",
] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePhase(phaseRaw: string | null | undefined): "booking" | "issuance" | "onboarding" {
  const phase = (phaseRaw ?? "").toLowerCase();
  if (phase === "issuance" || phase === "issuing") return "issuance";
  if (phase === "onboarding") return "onboarding";
  return "booking";
}

function buildInitialDocMap(uploadedTypes: Set<string>) {
  return {
    investment_form: uploadedTypes.has("investment_form"),
    bank_transfer_proof: uploadedTypes.has("bank_transfer_proof"),
  };
}

export default async function PortalInvestPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ investmentId?: string }>;
}) {
  const { slug } = await params;
  const { investmentId: investmentIdQuery } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/portal/${slug}/invest`)}`);
  }

  const context = (await getPortalContext(slug)) as PortalContext;
  if (!context.company) {
    return (
      <div className={styles.container}>
        <section className={styles.section}>
          <h1 className={styles.sectionTitle}>Portal investimento</h1>
          <p className={styles.pledgeIntro}>Company non trovata.</p>
        </section>
      </div>
    );
  }

  if (!context.investor_id || !context.investor_account) {
    return (
      <div className={styles.container}>
        <section className={styles.section}>
          <h1 className={styles.sectionTitle}>Portal investimento</h1>
          <p className={styles.pledgeIntro}>Non autorizzato.</p>
        </section>
      </div>
    );
  }

  const phase = normalizePhase(context.company.phase ?? context.phase);
  if (phase !== "issuance") {
    return (
      <div className={styles.container}>
        <section className={styles.section}>
          <h1 className={styles.sectionTitle}>Portal investimento</h1>
          <p className={styles.pledgeIntro}>La fase di investimento non è attiva.</p>
        </section>
      </div>
    );
  }

  const normalizedInvestmentId =
    typeof investmentIdQuery === "string" && UUID_RE.test(investmentIdQuery.trim())
      ? investmentIdQuery.trim()
      : null;

  const { data: activeRound } = await supabase
    .from("fundops_rounds")
    .select("id")
    .eq("company_id", context.company.id)
    .eq("status", "active")
    .maybeSingle();

  let investment:
    | { id: string; status: string | null; amount_eur: number | null; amount: number | null; privacy_accepted: boolean | null }
    | null = null;

  if (normalizedInvestmentId) {
    const { data } = await supabase
      .from("fundops_investments")
      .select("id, status, amount_eur, amount, privacy_accepted")
      .eq("id", normalizedInvestmentId)
      .eq("company_id", context.company.id)
      .eq("investor_id", context.investor_id)
      .maybeSingle();
    investment = data ?? null;
  }

  if (!investment && activeRound?.id) {
    const { data } = await supabase
      .from("fundops_investments")
      .select("id, status, amount_eur, amount, privacy_accepted")
      .eq("company_id", context.company.id)
      .eq("investor_id", context.investor_id)
      .eq("round_id", activeRound.id)
      .maybeSingle();
    investment = data ?? null;
  }

  if (!investment && activeRound?.id) {
    const { data: upserted } = await supabase
      .from("fundops_investments")
      .upsert(
        {
          company_id: context.company.id,
          round_id: activeRound.id,
          investor_id: context.investor_id,
          status: "draft",
          amount_eur: 0,
          privacy_accepted: false,
        },
        { onConflict: "investor_id,round_id" }
      )
      .select("id, status, amount_eur, amount, privacy_accepted")
      .maybeSingle();
    investment = upserted ?? null;
  }

  const { data: docs } = investment?.id
    ? await supabase
        .from("fundops_documents")
        .select("type")
        .eq("investment_id", investment.id)
        .eq("status", "active")
        .in("type", [...REQUIRED_DOC_TYPES])
    : { data: [] as Array<{ type: string }> };

  const uploadedTypes = new Set((docs ?? []).map((doc) => doc.type));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{context.company.name}</h1>
        <p className={styles.subtitle}>Invio investimento</p>
        <p className={styles.phaseBadge}>Fase: issuance</p>
      </header>

      <PortalInvestClient
        slug={slug}
        companyId={context.company.id}
        initialInvestmentId={investment?.id ?? null}
        initialDocs={buildInitialDocMap(uploadedTypes)}
        initialAmountEur={Number(investment?.amount_eur ?? investment?.amount ?? 0)}
        initialPrivacyAccepted={Boolean(investment?.privacy_accepted)}
        initiallySubmitted={investment?.status === "submitted" || investment?.status === "verified"}
      />
    </div>
  );
}
