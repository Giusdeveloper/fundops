import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import InvestorDetailClient from "./InvestorDetailClient";

interface PageProps {
  params: Promise<{
    investorId: string;
  }>;
}

export default async function InvestorDetailPage({ params }: PageProps) {
  const { investorId } = await params;

  // Recupera i dati dell'investitore
  const { data: investor, error: investorError } = await supabase
    .from("fundops_investors")
    .select("*")
    .eq("id", investorId)
    .maybeSingle();

  if (investorError || !investor) {
    return notFound();
  }

  // Recupera LOI collegate a questo investitore
  const { data: lois } = await supabase
    .from("fundops_lois")
    .select("*")
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });

  const loisData = lois || [];

  return (
    <InvestorDetailClient
      investor={investor}
      lois={loisData}
    />
  );
}
