import {
  createSupabaseAdminClient,
  getUsersByIds,
  parseArgs,
  resolveImmentCompany,
} from "./_supabaseAdmin.mjs";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function selectAll(admin, table, queryBuilder) {
  const { data, error } = await queryBuilder(admin.from(table).select("*"));
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return [];
    }
    throw new Error(`Failed loading ${table}: ${error.message}`);
  }
  return data ?? [];
}

async function deleteByIds(admin, table, ids) {
  if (!ids.length) return 0;
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return 0;
    throw new Error(`Failed deleting ${table}: ${error.message}`);
  }
  return ids.length;
}

async function main() {
  const options = parseArgs(process.argv);
  const execute = Boolean(options.execute);
  const admin = createSupabaseAdminClient();
  const company = await resolveImmentCompany(admin, String(options.company ?? "imment"));

  const lois = await selectAll(admin, "fundops_lois", (query) =>
    query.eq("company_id", company.id)
  );
  const loiIds = lois.map((row) => row.id);

  const signers = loiIds.length
    ? await selectAll(admin, "fundops_loi_signers", (query) => query.in("loi_id", loiIds))
    : [];
  const signerIds = signers.map((row) => row.id);

  const signerEvents = signerIds.length
    ? await selectAll(admin, "fundops_loi_signer_events", (query) =>
        query.in("signer_id", signerIds)
      )
    : [];

  const loiEvents = loiIds.length
    ? await selectAll(admin, "fundops_loi_events", (query) => query.in("loi_id", loiIds))
    : [];

  const documents = await selectAll(admin, "fundops_documents", (query) =>
    query.eq("company_id", company.id)
  );
  const investments = await selectAll(admin, "fundops_investments", (query) =>
    query.eq("company_id", company.id)
  );
  const rounds = await selectAll(admin, "fundops_rounds", (query) =>
    query.eq("company_id", company.id)
  );
  const invites = await selectAll(admin, "fundops_invites", (query) =>
    query.eq("company_id", company.id)
  );
  const investorAccounts = await selectAll(admin, "fundops_investor_accounts", (query) =>
    query.eq("company_id", company.id)
  );
  const capTableScenarios = await selectAll(admin, "fundops_cap_table_scenarios", (query) =>
    query.eq("company_id", company.id)
  );
  const seats = await selectAll(admin, "fundops_company_users", (query) =>
    query.eq("company_id", company.id)
  );
  const userIds = unique(seats.map((seat) => seat.user_id));
  const profiles = await getUsersByIds(admin, userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const nonStaffSeats = seats.filter((seat) => {
    const profile = profileById.get(seat.user_id);
    const role = profile?.role_global ?? null;
    return role !== "imment_admin" && role !== "imment_operator";
  });

  const summary = {
    company: {
      id: company.id,
      name: company.name,
      public_slug: company.public_slug ?? null,
      phase: company.phase ?? null,
    },
    counts: {
      fundops_cap_table_scenarios: capTableScenarios.length,
      fundops_documents: documents.length,
      fundops_lois: lois.length,
      fundops_loi_signers: signers.length,
      fundops_loi_signer_events: signerEvents.length,
      fundops_loi_events: loiEvents.length,
      fundops_investments: investments.length,
      fundops_rounds: rounds.length,
      fundops_invites: invites.length,
      fundops_investor_accounts: investorAccounts.length,
      non_staff_seats_to_disable: nonStaffSeats.length,
    },
    non_staff_seats: nonStaffSeats.map((seat) => ({
      id: seat.id,
      user_id: seat.user_id,
      email: profileById.get(seat.user_id)?.email ?? null,
      role_global: profileById.get(seat.user_id)?.role_global ?? null,
      is_active: seat.is_active ?? null,
    })),
  };

  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", ...summary }, null, 2));

  if (!execute) {
    return;
  }

  await deleteByIds(admin, "fundops_cap_table_scenarios", capTableScenarios.map((row) => row.id));
  await deleteByIds(admin, "fundops_documents", documents.map((row) => row.id));
  await deleteByIds(admin, "fundops_loi_signer_events", signerEvents.map((row) => row.id));
  await deleteByIds(admin, "fundops_loi_signers", signers.map((row) => row.id));
  await deleteByIds(admin, "fundops_loi_events", loiEvents.map((row) => row.id));
  await deleteByIds(admin, "fundops_lois", loiIds);
  await deleteByIds(admin, "fundops_investments", investments.map((row) => row.id));
  await deleteByIds(admin, "fundops_rounds", rounds.map((row) => row.id));
  await deleteByIds(admin, "fundops_invites", invites.map((row) => row.id));
  await deleteByIds(admin, "fundops_investor_accounts", investorAccounts.map((row) => row.id));

  if (nonStaffSeats.length > 0) {
    const now = new Date().toISOString();
    const { error: seatError } = await admin
      .from("fundops_company_users")
      .update({
        is_active: false,
        disabled_reason: "Soft reset Imment for internal founder testing",
        disabled_at: now,
        updated_at: now,
      })
      .in("id", nonStaffSeats.map((seat) => seat.id));

    if (seatError) {
      throw new Error(`Failed disabling seats: ${seatError.message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        completed: true,
        company_id: company.id,
        disabled_seats: nonStaffSeats.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
