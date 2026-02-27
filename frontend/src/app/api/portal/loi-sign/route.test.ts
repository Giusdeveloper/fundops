import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type RpcArgs = {
  p_company_id: string;
  p_full_name: string;
};

type MockState = {
  user: { id: string } | null;
  authError: { message: string } | null;
  rpcError: { message: string; code?: string } | null;
  rpcData: unknown;
  rpcCalls: Array<{ fn: string; args: RpcArgs }>;
};

function makeMockState(): MockState {
  return {
    user: { id: "user-1" },
    authError: null,
    rpcError: null,
    rpcData: { signed_at: "2026-02-18T00:00:00.000Z" },
    rpcCalls: [],
  };
}

let state = makeMockState();

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: state.user },
      error: state.authError,
    })),
  },
  rpc: vi.fn(async (fn: string, args: RpcArgs) => {
    state.rpcCalls.push({ fn, args });
    return { data: state.rpcData, error: state.rpcError };
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabaseMock),
}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: null,
}));

async function post(body: Record<string, unknown>) {
  const { POST } = await import("./route");
  const req = new NextRequest("http://localhost/api/portal/loi-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

describe("POST /api/portal/loi-sign (RPC-only)", () => {
  beforeEach(() => {
    state = makeMockState();
    vi.clearAllMocks();
  });

  it("returns 400 when companyId/fullName are missing", async () => {
    const res = await post({ companyId: "", fullName: "" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("returns 401 when user is not authenticated", async () => {
    state.user = null;
    const res = await post({ companyId: "company-1", fullName: "Mario Rossi" });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("calls RPC and returns 200 on success", async () => {
    const res = await post({ companyId: "company-1", fullName: "Mario Rossi" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(state.rpcCalls[0]).toEqual({
      fn: "portal_sign_master_loi",
      args: {
        p_company_id: "company-1",
        p_full_name: "Mario Rossi",
      },
    });
  });

  it("returns 400 when RPC returns error", async () => {
    state.rpcError = { message: "not allowed", code: "PGRST116" };
    const res = await post({ companyId: "company-1", fullName: "Mario Rossi" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("PGRST116");
  });
});
