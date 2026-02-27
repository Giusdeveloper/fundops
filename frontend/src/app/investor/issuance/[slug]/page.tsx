import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import InvestorIssuanceClient from "./InvestorIssuanceClient";

export default async function InvestorIssuancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect(`/login?redirect=${encodeURIComponent(`/investor/issuance/${slug}`)}`);
  }

  const { data: company } = await supabase
    .from("fundops_companies")
    .select("id,name,phase,public_slug")
    .eq("public_slug", slug)
    .maybeSingle();

  if (!company) {
    return <div>Company non trovata.</div>;
  }

  const phase = (company.phase ?? "").toLowerCase();
  const isIssuancePhase = phase === "issuance" || phase === "issuing";
  if (!isIssuancePhase) {
    return <div>La fase di investimento non è attiva.</div>;
  }

  return (
    <InvestorIssuanceClient
      slug={slug}
      companyId={company.id}
      companyName={company.name ?? "Company"}
    />
  );
}
