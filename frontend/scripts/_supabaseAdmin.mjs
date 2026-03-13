import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(FRONTEND_ROOT, ".env.local");

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadLocalEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Missing env file: ${ENV_PATH}`);
  }

  const raw = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function createSupabaseAdminClient() {
  loadLocalEnv();

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_SERVICE_KEY ??
    null;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL");
  }

  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function resolveImmentCompany(admin, query = "imment") {
  const { data, error } = await admin
    .from("fundops_companies")
    .select("*")
    .or(`name.ilike.%${query}%,legal_name.ilike.%${query}%,public_slug.eq.imment-srl`);

  if (error) {
    throw new Error(`Failed to load companies: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No company found matching "${query}"`);
  }

  const exact =
    data.find((company) => company.public_slug === "imment-srl") ??
    data.find((company) => company.name?.toLowerCase() === "imment srl") ??
    data.find((company) => (company.name ?? "").toLowerCase().includes("imment")) ??
    data[0];

  return exact;
}

export function parseArgs(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

export async function getUsersByIds(admin, userIds) {
  if (!userIds.length) return [];
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role_global, is_active")
    .in("id", userIds);

  if (error) {
    throw new Error(`Failed to load profiles: ${error.message}`);
  }

  return data ?? [];
}
