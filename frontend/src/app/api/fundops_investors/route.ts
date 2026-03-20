import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccessCompany, getUserRoleContext } from '@/lib/companyAccess';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId')?.trim();
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const query = supabase
      .from('fundops_investors')
      .select('*');

    query.or(`client_company_id.eq.${companyId},company_id.eq.${companyId}`);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const {
      company_id,
      full_name,
      email,
      phone,
      category,
      investor_type,
      linkedin,
      motivation,
      activity,
      notes,
    } = await request.json();

    if (!company_id || company_id.trim() === '') {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!full_name || !email) {
      return NextResponse.json(
        { error: 'full_name and email are required' },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(String(email).trim())) {
      return NextResponse.json({ error: "Email non valida" }, { status: 400 });
    }

    const normalizedCompanyId = company_id.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, normalizedCompanyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const noteParts = [
      typeof motivation === "string" && motivation.trim() ? `Motivazione: ${motivation.trim()}` : null,
      typeof activity === "string" && activity.trim() ? `Attività / professione: ${activity.trim()}` : null,
      typeof notes === "string" && notes.trim() ? notes.trim() : null,
    ].filter(Boolean);

    const { data, error } = await supabase.rpc("create_fundops_investor", {
      p_company_id: normalizedCompanyId,
      p_full_name: full_name,
      p_email: String(email).trim().toLowerCase(),
      p_phone: phone ?? null,
      p_category: category ?? null,
      p_investor_type: investor_type ?? category ?? null,
      p_linkedin: typeof linkedin === "string" && linkedin.trim() ? linkedin.trim() : null,
      p_notes: noteParts.length > 0 ? noteParts.join("\n\n") : null,
    });

    if (error) {
      const status = error.message.includes("permissions") ? 403 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

