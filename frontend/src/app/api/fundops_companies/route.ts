import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAccessibleCompanyIds,
  getUserRoleContext,
  isGlobalFundopsRole,
} from '@/lib/companyAccess';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const roleContext = await getUserRoleContext(supabase, user.id);
  if (!roleContext.isActive) {
    return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
  }

  let data;
  let error;

  if (isGlobalFundopsRole(roleContext.role)) {
    ({ data, error } = await supabase.from('fundops_companies').select('*'));
  } else {
    const companyIds = await getAccessibleCompanyIds(supabase, user.id, roleContext);
    if (companyIds.length === 0) {
      return NextResponse.json({ data: [] });
    }
    ({ data, error } = await supabase
      .from('fundops_companies')
      .select('*')
      .in('id', companyIds));
  }

  if (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }
    if (!isGlobalFundopsRole(roleContext.role)) {
      return NextResponse.json({ error: "Permessi insufficienti" }, { status: 403 });
    }

    const { name, legal_name, vat_number, address } = await request.json();

    if (!name || !legal_name || !vat_number || !address) {
      return NextResponse.json(
        { error: 'name, legal_name, vat_number e address sono obbligatori' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('fundops_companies')
      .insert({ name, legal_name, vat_number, address })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

