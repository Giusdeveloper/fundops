import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import AccountWorkspace from "./AccountWorkspace";
import styles from "./account.module.css";

function getRoleLabel(roleGlobal: string | null): string {
  if (roleGlobal === "imment_admin") return "Imment Admin";
  if (roleGlobal === "imment_operator") return "Imment Operator";
  if (roleGlobal === "founder") return "Founder";
  if (roleGlobal === "investor") return "Supporter";
  return "Profilo";
}

function getAreaLabel(roleGlobal: string | null, viewMode: string | null): string {
  if (roleGlobal === "investor") return "Vista Supporter";
  if (roleGlobal === "imment_admin") {
    return viewMode === "investor" ? "Vista Supporter" : "Vista Startup";
  }
  return "Vista Startup";
}

export default async function AccountPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile },
    { data: companySeats },
    { data: investorLinks },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, email, avatar_url, role_global, view_mode, is_active, created_at, updated_at, disabled_reason, disabled_at, first_investor_login_at"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("fundops_company_users")
      .select("company_id, role")
      .eq("user_id", user.id),
    supabase
      .from("fundops_investor_users")
      .select("investor_id")
      .eq("user_id", user.id),
  ]);

  const profileName =
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Utente";
  const profileEmail = profile?.email ?? user.email ?? "-";
  const roleLabel = getRoleLabel(profile?.role_global ?? null);
  const areaLabel = getAreaLabel(
    profile?.role_global ?? null,
    profile?.view_mode ?? null
  );
  const seatCount = companySeats?.length ?? 0;
  const adminSeatCount =
    companySeats?.filter((seat) => seat.role === "company_admin").length ?? 0;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const accountCreatedAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  const providerLabel =
    (user.app_metadata?.provider as string | undefined)?.replace("_", " ") ??
    "email";
  const emailConfirmed = Boolean(user.email_confirmed_at);
  const profileUpdatedAt = profile?.updated_at
    ? new Date(profile.updated_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const firstInvestorLoginAt = profile?.first_investor_login_at
    ? new Date(profile.first_investor_login_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const disabledAt = profile?.disabled_at
    ? new Date(profile.disabled_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const directCompanyIds = Array.from(
    new Set((companySeats ?? []).map((seat) => seat.company_id))
  );
  const { data: directCompanies } = directCompanyIds.length
    ? await supabase
        .from("fundops_companies")
        .select("id, name, legal_name")
        .in("id", directCompanyIds)
    : { data: [] as Array<{ id: string; name: string | null; legal_name: string | null }> };

  const directCompaniesMap = new Map(
    (directCompanies ?? []).map((company) => [
      company.id,
      company.name ?? company.legal_name ?? company.id,
    ])
  );

  const seatSummary = (companySeats ?? []).map((seat) => ({
    companyId: seat.company_id,
    companyName: directCompaniesMap.get(seat.company_id) ?? seat.company_id,
    role: seat.role ?? "member",
  }));

  const investorIds = (investorLinks ?? []).map((item) => item.investor_id);
  const { data: investorAccounts } = investorIds.length
    ? await supabase
        .from("fundops_investor_accounts")
        .select("company_id, lifecycle_stage, is_active")
        .in("investor_id", investorIds)
    : { data: [] as Array<{ company_id: string; lifecycle_stage: string | null; is_active: boolean | null }> };

  const investorCompanyIds = Array.from(
    new Set((investorAccounts ?? []).map((account) => account.company_id))
  );
  const { data: investorCompanies } = investorCompanyIds.length
    ? await supabase
        .from("fundops_companies")
        .select("id, name, legal_name")
        .in("id", investorCompanyIds)
    : { data: [] as Array<{ id: string; name: string | null; legal_name: string | null }> };

  const investorCompaniesMap = new Map(
    (investorCompanies ?? []).map((company) => [
      company.id,
      company.name ?? company.legal_name ?? company.id,
    ])
  );

  const investorAccessSummary = (investorAccounts ?? []).map((account) => ({
    companyId: account.company_id,
    companyName:
      investorCompaniesMap.get(account.company_id) ?? account.company_id,
    lifecycleStage: account.lifecycle_stage ?? "-",
    isActive: account.is_active !== false,
  }));

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Foto profilo di ${profileName}`}
            className={styles.avatarImage}
          />
        ) : (
          <div className={styles.avatar} aria-hidden="true">
            {profileName
              .split(" ")
              .map((part: string) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Account</p>
          <h1 className={styles.title}>{profileName}</h1>
          <p className={styles.subtitle}>
            {roleLabel} | {areaLabel}
          </p>
          <p className={styles.email}>{profileEmail}</p>
        </div>
      </section>

      <AccountWorkspace
        profileName={profileName}
        profileEmail={profileEmail}
        roleLabel={roleLabel}
        roleGlobal={profile?.role_global ?? null}
        areaLabel={areaLabel}
        avatarUrl={profile?.avatar_url ?? null}
        initialViewMode={profile?.view_mode === "investor" ? "investor" : "startup"}
        canSwitchViewMode={profile?.role_global === "imment_admin"}
        seatCount={seatCount}
        adminSeatCount={adminSeatCount}
        memberSince={memberSince}
        isActive={profile?.is_active !== false}
        accountCreatedAt={accountCreatedAt}
        lastSignIn={lastSignIn}
        providerLabel={providerLabel}
        emailConfirmed={emailConfirmed}
        userId={user.id}
        profileUpdatedAt={profileUpdatedAt}
        firstInvestorLoginAt={firstInvestorLoginAt}
        disabledReason={profile?.disabled_reason ?? null}
        disabledAt={disabledAt}
        seatSummary={seatSummary}
        investorAccessSummary={investorAccessSummary}
      />
    </div>
  );
}
