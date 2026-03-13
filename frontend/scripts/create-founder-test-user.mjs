import crypto from "node:crypto";
import {
  createSupabaseAdminClient,
  parseArgs,
  resolveImmentCompany,
} from "./_supabaseAdmin.mjs";

function randomPassword() {
  return `Founder!${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

async function findAuthUserByEmail(admin, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed listing auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function ensureSeat(admin, userId, companyId) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    company_id: companyId,
    role: "company_admin",
    is_active: true,
    disabled_reason: null,
    disabled_at: null,
    updated_at: now,
  };

  let { error } = await admin
    .from("fundops_company_users")
    .upsert(payload, { onConflict: "user_id,company_id" });

  if (!error) return;

  if (error.message?.toLowerCase().includes("role")) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.role;
    ({ error } = await admin
      .from("fundops_company_users")
      .upsert(fallbackPayload, { onConflict: "user_id,company_id" }));
  }

  if (error) {
    throw new Error(`Failed upserting founder seat: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const email = String(options.email ?? "founder.imment.test@imment.it").trim();
  const password = String(options.password ?? randomPassword());
  const admin = createSupabaseAdminClient();
  const company = await resolveImmentCompany(admin, String(options.company ?? "imment"));

  let authUser = await findAuthUserByEmail(admin, email);

  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Founder Imment Test",
      },
    });

    if (error || !data.user) {
      throw new Error(`Failed creating founder test user: ${error?.message ?? "unknown error"}`);
    }

    authUser = data.user;
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(authUser.user_metadata ?? {}),
        full_name: "Founder Imment Test",
      },
    });

    if (error || !data.user) {
      throw new Error(`Failed updating founder test user: ${error?.message ?? "unknown error"}`);
    }

    authUser = data.user;
  }

  const profilePayload = {
    id: authUser.id,
    email,
    full_name: "Founder Imment Test",
    role_global: "founder",
    view_mode: "startup",
    is_active: true,
    disabled_reason: null,
    disabled_at: null,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (profileError) {
    throw new Error(`Failed upserting founder profile: ${profileError.message}`);
  }

  await ensureSeat(admin, authUser.id, company.id);

  console.log(
    JSON.stringify(
      {
        company_id: company.id,
        company_name: company.name,
        user_id: authUser.id,
        email,
        password,
        role_global: "founder",
        view_mode: "startup",
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
