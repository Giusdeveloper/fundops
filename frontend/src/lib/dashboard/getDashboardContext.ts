import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardRoundContext {
  id: string;
  status: string | null;
  booking_open: boolean | null;
  issuance_open: boolean | null;
  booking_deadline: string | null;
  issuance_deadline: string | null;
  target_amount: number | null;
}

export interface DashboardContext {
  round: DashboardRoundContext | null;
  signedLoiCount: number;
  softCommitmentSum: number;
  investorsCount: number;
  bookingProgressPct: number | null;
  bookingProgressLabel: string | null;
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function getDashboardContext(
  supabase: SupabaseClient,
  companyId: string
): Promise<DashboardContext> {
  const fallbackContext: DashboardContext = {
    round: null,
    signedLoiCount: 0,
    softCommitmentSum: 0,
    investorsCount: 0,
    bookingProgressPct: null,
    bookingProgressLabel: null,
  };

  const trimmedCompanyId = companyId.trim();
  if (!trimmedCompanyId) {
    return fallbackContext;
  }

  const roundSelectBase =
    "id,status,booking_open,issuance_open,booking_deadline,issuance_deadline,created_at";

  type RoundRow = {
    id: string;
    status: string | null;
    booking_open: boolean | null;
    issuance_open: boolean | null;
    booking_deadline: string | null;
    issuance_deadline: string | null;
    created_at?: string;
    target_amount?: number | null;
  };

  const fetchRoundWithTarget = async (onlyActive: boolean) => {
    const query = supabase
      .from("fundops_rounds")
      .select(`${roundSelectBase},target_amount`)
      .eq("company_id", trimmedCompanyId)
      .order("created_at", { ascending: false })
      .limit(1);
    const base = onlyActive ? query.eq("status", "active") : query;
    const result = await base.maybeSingle();
    return result as { data: RoundRow | null; error: unknown };
  };

  const fetchRoundWithoutTarget = async (onlyActive: boolean) => {
    const query = supabase
      .from("fundops_rounds")
      .select(roundSelectBase)
      .eq("company_id", trimmedCompanyId)
      .order("created_at", { ascending: false })
      .limit(1);
    const base = onlyActive ? query.eq("status", "active") : query;
    const result = await base.maybeSingle();
    return result as { data: RoundRow | null; error: unknown };
  };

  const fetchRoundMaybeSingle = async (onlyActive: boolean) => {
    let result = await fetchRoundWithTarget(onlyActive);
    const missingTargetColumn =
      result.error &&
      (typeof result.error === "object" &&
        ("code" in result.error
          ? (result.error as { code?: string }).code === "42703"
          : false)) ||
      (result.error &&
        typeof result.error === "object" &&
        "message" in result.error &&
        String((result.error as { message?: unknown }).message ?? "")
          .toLowerCase()
          .includes("target_amount"));

    if (result.error && missingTargetColumn) {
      console.error("[Dashboard] round target_amount missing, fallback select", result.error);
      result = await fetchRoundWithoutTarget(onlyActive);
    }
    return result;
  };

  const { data: activeRound, error: activeRoundError } = await fetchRoundMaybeSingle(true);

  if (activeRoundError) {
    console.error("[Dashboard] activeRoundError", activeRoundError);
  }

  let resolvedRound = activeRound;
  if (!resolvedRound && !activeRoundError) {
    const { data: latestRound, error: latestRoundError } = await fetchRoundMaybeSingle(false);

    if (latestRoundError) {
      console.error("[Dashboard] latestRoundError", latestRoundError);
    } else {
      resolvedRound = latestRound;
    }
  }

  const round: DashboardRoundContext | null = resolvedRound
    ? {
        id: resolvedRound.id,
        status: resolvedRound.status,
        booking_open: resolvedRound.booking_open,
        issuance_open: resolvedRound.issuance_open,
        booking_deadline: resolvedRound.booking_deadline,
        issuance_deadline: resolvedRound.issuance_deadline,
        target_amount:
          "target_amount" in resolvedRound &&
          resolvedRound.target_amount != null &&
          Number.isFinite(Number(resolvedRound.target_amount))
            ? Number(resolvedRound.target_amount)
            : null,
      }
    : null;

  const { data: sentMasterLois, error: sentMasterLoisError } = await supabase
    .from("fundops_lois")
    .select("id")
    .eq("company_id", trimmedCompanyId)
    .eq("is_master", true)
    .eq("status", "sent");

  if (sentMasterLoisError) {
    console.error("[Dashboard] sentMasterLoisError", sentMasterLoisError);
  }

  const sentMasterLoiIds = (sentMasterLois ?? []).map((row) => row.id);
  let signedLoiCount = 0;
  let softCommitmentSum = 0;

  if (sentMasterLoiIds.length > 0) {
    const {
      data: signedSigners,
      count: signedSignersCount,
      error: signedSignersError,
    } = await supabase
      .from("fundops_loi_signers")
      .select("indicative_amount", { count: "exact" })
      .in("loi_id", sentMasterLoiIds)
      .eq("status", "signed");

    if (signedSignersError) {
      console.error("[Dashboard] signedSignersError", signedSignersError);
    } else {
      signedLoiCount = signedSignersCount ?? signedSigners?.length ?? 0;
      softCommitmentSum = (signedSigners ?? []).reduce((acc, row) => {
        const amount = Number(row.indicative_amount ?? 0);
        return acc + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    }
  }

  const {
    count: investorsWithActiveCount,
    error: investorsWithActiveError,
  } = await supabase
    .from("fundops_investor_accounts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", trimmedCompanyId)
    .eq("is_active", true);

  let investorsCount = 0;
  if (investorsWithActiveError) {
    console.error("[Dashboard] investorsWithActiveError", investorsWithActiveError);

    const { count: investorsFallbackCount, error: investorsFallbackError } =
      await supabase
        .from("fundops_investor_accounts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", trimmedCompanyId);

    if (investorsFallbackError) {
      console.error("[Dashboard] investorsFallbackError", investorsFallbackError);
    } else {
      investorsCount = investorsFallbackCount ?? 0;
    }
  } else {
    investorsCount = investorsWithActiveCount ?? 0;
  }

  let bookingProgressPct: number | null = null;
  let bookingProgressLabel: string | null = null;
  const targetAmount =
    round?.target_amount == null ? null : Number(round.target_amount);
  if (targetAmount != null && Number.isFinite(targetAmount)) {
    const rawPct =
      targetAmount > 0 ? (softCommitmentSum / targetAmount) * 100 : 0;
    bookingProgressPct = Math.max(0, Math.min(100, rawPct));
    bookingProgressLabel = `su target ${formatEur(targetAmount)}`;
  }

  return {
    round,
    signedLoiCount,
    softCommitmentSum,
    investorsCount,
    bookingProgressPct,
    bookingProgressLabel,
  };
}
