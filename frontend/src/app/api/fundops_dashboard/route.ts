import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessCompany, getUserRoleContext } from "@/lib/companyAccess";

interface InvestorNameRow {
  id: string;
  full_name: string | null;
}

interface DashboardEventRow {
  id: string;
  loi_id: string;
  event_type: string;
  label: string | null;
  created_at: string;
}

interface DashboardLoiForEventRow {
  id: string;
  title: string | null;
  investor_id: string | null;
}

interface TodoItemWithExpiryUTC {
  loiId: string;
  loiTitle: string | null;
  investorName: string | null;
  status: "draft" | "sent" | "signed" | "expired" | "cancelled";
  daysToExpiry: number;
  suggestedAction: "send" | "reminder";
  lastReminderAt: string | null;
  daysSinceLastReminder: number | null;
  reminderCooldownDaysLeft: number | null;
  expiryUTC: number;
}

/**
 * GET - Ottiene dati aggregati per la dashboard
 * Ritorna: KPI, todo list, recent events
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyIdParam = searchParams.get("companyId");

    if (!companyIdParam || companyIdParam.trim() === "") {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const companyId = companyIdParam.trim();
    const roleContext = await getUserRoleContext(supabase, user.id);
    if (!roleContext.isActive) {
      return NextResponse.json({ error: "Accesso disabilitato" }, { status: 403 });
    }

    const hasAccess = await canAccessCompany(supabase, user.id, companyId, roleContext);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calcola la data di 30 giorni fa
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    // Calcola oggi (inizio giornata)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Calcola 30 giorni da oggi
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);
    const thirtyDaysFromNowISO = thirtyDaysFromNow.toISOString();

    // 1. KPI: Pipeline totale (somma ticket_amount per LOI draft/sent)
    const { data: pipelineLois, error: pipelineError } = await supabase
      .from("fundops_lois")
      .select("ticket_amount")
      .eq("company_id", companyId)
      .in("status", ["draft", "sent"]);

    if (pipelineError) {
      console.error("Error fetching pipeline LOIs:", pipelineError);
    }

    const pipelineTotal = (pipelineLois || []).reduce(
      (sum, loi) => sum + (loi.ticket_amount || 0),
      0
    );

    // 2. KPI: Committed (somma ticket_amount per LOI signed)
    const { data: committedLois, error: committedError } = await supabase
      .from("fundops_lois")
      .select("ticket_amount")
      .eq("company_id", companyId)
      .eq("status", "signed");

    if (committedError) {
      console.error("Error fetching committed LOIs:", committedError);
    }

    const committedTotal = (committedLois || []).reduce(
      (sum, loi) => sum + (loi.ticket_amount || 0),
      0
    );

    // 3. KPI: LOI in scadenza (<=30 giorni, status draft/sent)
    const { data: expiringLois, error: expiringError } = await supabase
      .from("fundops_lois")
      .select("id, expiry_date, status")
      .eq("company_id", companyId)
      .in("status", ["draft", "sent"])
      .not("expiry_date", "is", null)
      .lte("expiry_date", thirtyDaysFromNowISO)
      .gte("expiry_date", todayISO);

    if (expiringError) {
      console.error("Error fetching expiring LOIs:", expiringError);
    }

    const expiringCount = (expiringLois || []).length;

    // 4. KPI: Reminder inviati (ultimi 30 giorni)
    // Calcola da eventi fundops_loi_events (source of truth)
    // Count eventi type = "reminder" negli ultimi 30 giorni per companyId
    let remindersLast30Days = 0;
    try {
      // Ottieni gli ID delle LOI della company
      const { data: companyLois } = await supabase
        .from("fundops_lois")
        .select("id")
        .eq("company_id", companyId);

      const companyLoiIds = (companyLois || []).map((l) => l.id);

      if (companyLoiIds.length > 0) {
        const { data: reminderEvents, error: reminderError } = await supabase
          .from("fundops_loi_events")
          .select("id")
          .eq("event_type", "reminder")
          .in("loi_id", companyLoiIds)
          .gte("created_at", thirtyDaysAgoISO);

        if (reminderError) {
          console.error("Error fetching reminder events:", reminderError);
          remindersLast30Days = 0;
        } else {
          remindersLast30Days = (reminderEvents || []).length;
        }
      }
    } catch (err) {
      console.warn("Errore nel calcolo remindersLast30Days:", err);
      remindersLast30Days = 0;
    }

    // 5. TODO LIST: Top 5 azioni prioritarie
    // Carica tutte le LOI draft/sent con expiry_date (senza filtro date nella query)
    const { data: allTodoLois, error: loisError } = await supabase
      .from("fundops_lois")
      .select(
        `
        id,
        title,
        expiry_date,
        status,
        investor_id
      `
      )
      .eq("company_id", companyId)
      .in("status", ["draft", "sent"])
      .not("expiry_date", "is", null);

    if (loisError) {
      console.error("Error fetching LOIs for todo:", loisError);
    }

    // Carica investitori per i nomi (evita N+1)
    const investorIds = Array.from(
      new Set((allTodoLois || []).map((l) => l.investor_id).filter(Boolean))
    );
    let investors: InvestorNameRow[] = [];
    if (investorIds.length > 0) {
      const { data } = await supabase
        .from("fundops_investors")
        .select("id, full_name")
        .in("id", investorIds);
      investors = (data ?? []) as InvestorNameRow[];
    }

    const investorMap = new Map(
      investors.map((inv) => [inv.id, inv.full_name])
    );

    // Calcola daysToExpiry UTC-safe (tratta expiry_date come date-only YYYY-MM-DD)
    // Crea today come date-only senza timezone offset
    const todayDateOnly = new Date();
    todayDateOnly.setUTCHours(0, 0, 0, 0);
    const todayYear = todayDateOnly.getUTCFullYear();
    const todayMonth = todayDateOnly.getUTCMonth();
    const todayDay = todayDateOnly.getUTCDate();
    const todayUTC = Date.UTC(todayYear, todayMonth, todayDay);

    // Helper per calcolare giorni da expiry_date (YYYY-MM-DD string)
    const calculateDaysToExpiry = (expiryDateString: string): number | null => {
      if (!expiryDateString) return null;
      
      // Parsa expiry_date come date-only (YYYY-MM-DD)
      const parts = expiryDateString.split("-");
      if (parts.length !== 3) return null;
      
      const expiryYear = parseInt(parts[0], 10);
      const expiryMonth = parseInt(parts[1], 10) - 1; // Month è 0-indexed
      const expiryDay = parseInt(parts[2], 10);
      
      const expiryUTC = Date.UTC(expiryYear, expiryMonth, expiryDay);
      const diffMs = expiryUTC - todayUTC;
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      return days;
    };

    // Calcola 30 giorni da oggi (date-only)
    const thirtyDaysFromTodayUTC = todayUTC + (30 * 24 * 60 * 60 * 1000);

    // Carica ultimi eventi reminder per ogni LOI (per cooldown)
    const loiIdsForTodo = (allTodoLois || []).map((l) => l.id);
    let lastReminderMap = new Map<string, string>(); // loiId -> lastReminderAt ISO string
    
    if (loiIdsForTodo.length > 0) {
      try {
        // Query per ottenere l'ultimo evento reminder per ogni LOI
        const { data: reminderEvents } = await supabase
          .from("fundops_loi_events")
          .select("loi_id, created_at")
          .eq("event_type", "reminder")
          .in("loi_id", loiIdsForTodo)
          .order("created_at", { ascending: false });

        if (reminderEvents) {
          // Raggruppa per loi_id e prendi il più recente
          const reminderByLoi = new Map<string, string>();
          for (const event of reminderEvents) {
            if (!reminderByLoi.has(event.loi_id)) {
              reminderByLoi.set(event.loi_id, event.created_at);
            }
          }
          lastReminderMap = reminderByLoi;
        }
      } catch (err) {
        console.warn("Errore nel caricamento degli eventi reminder per cooldown:", err);
        // Continua senza cooldown se gli eventi non sono disponibili
      }
    }

    // Calcola oggi per il cooldown (timestamp)
    const todayTimestamp = new Date().getTime();
    // Costruisci todo items con filtro e ordinamento
    const allTodoItems: TodoItemWithExpiryUTC[] = (allTodoLois || [])
      .map((loi) => {
        if (!loi.expiry_date) return null;

        const daysToExpiry = calculateDaysToExpiry(loi.expiry_date);
        if (daysToExpiry === null) return null;

        const normalizedStatus = (loi.status?.toLowerCase() || "") as "draft" | "sent" | "signed" | "expired" | "cancelled";
        
        // Regola suggestedAction semplice:
        // status='draft' -> 'send'
        // status='sent' -> 'reminder'
        const suggestedAction: "send" | "reminder" = normalizedStatus === "draft" ? "send" : "reminder";

        // Calcola lastReminderAt e cooldown da eventi
        const lastReminderAtISO = lastReminderMap.get(loi.id) || null;
        let lastReminderAt: string | null = null;
        let daysSinceLastReminder: number | null = null;
        let reminderCooldownDaysLeft: number | null = null;

        if (lastReminderAtISO) {
          lastReminderAt = lastReminderAtISO;
          const lastReminderTimestamp = new Date(lastReminderAtISO).getTime();
          const diffMs = todayTimestamp - lastReminderTimestamp;
          daysSinceLastReminder = Math.floor(diffMs / (24 * 60 * 60 * 1000));

          // Cooldown: se reminder inviato negli ultimi 7 giorni, calcola giorni rimanenti
          if (daysSinceLastReminder < 7) {
            reminderCooldownDaysLeft = 7 - daysSinceLastReminder;
          }
        }

        // Parsa expiry_date per il filtro
        const parts = loi.expiry_date.split("-");
        if (parts.length !== 3) return null;
        const expiryYear = parseInt(parts[0], 10);
        const expiryMonth = parseInt(parts[1], 10) - 1;
        const expiryDay = parseInt(parts[2], 10);
        const expiryUTC = Date.UTC(expiryYear, expiryMonth, expiryDay);

        return {
          loiId: loi.id,
          loiTitle: loi.title,
          investorName: loi.investor_id ? (investorMap.get(loi.investor_id) || null) : null,
          status: normalizedStatus,
          daysToExpiry,
          suggestedAction,
          lastReminderAt,
          daysSinceLastReminder,
          reminderCooldownDaysLeft,
          expiryUTC, // Per il filtro
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Applica filtro: expiry_date >= today AND expiry_date <= today + 30 days
    const filteredTodoItems = allTodoItems.filter(
      (item) => item.expiryUTC >= todayUTC && item.expiryUTC <= thirtyDaysFromTodayUTC
    );

    // Ordina per daysToExpiry ASC (più urgente prima)
    const sortedTodoItems = filteredTodoItems.sort((a, b) => {
      // Ordina per: daysToExpiry ASC (più urgente prima)
      if (a.daysToExpiry !== b.daysToExpiry) {
        return a.daysToExpiry - b.daysToExpiry;
      }
      // A parità di giorni: sent prima di draft (reminder ha priorità)
      if (a.status === "sent" && b.status === "draft") return -1;
      if (a.status === "draft" && b.status === "sent") return 1;
      return 0;
    });

    // Se nessuna LOI rientra nel filtro, fallback alle prime 5 senza filtro
    const toPublicTodoItem = (item: TodoItemWithExpiryUTC) => {
      const { expiryUTC: _expiryUTC, ...rest } = item;
      void _expiryUTC;
      return rest;
    };
    let todoItems: Array<Omit<TodoItemWithExpiryUTC, "expiryUTC">>;
    if (sortedTodoItems.length === 0) {
      // Fallback: ordina tutte le LOI per daysToExpiry ASC e prendi le prime 5
      const fallbackSorted = allTodoItems.sort((a, b) => {
        if (a.daysToExpiry !== b.daysToExpiry) {
          return a.daysToExpiry - b.daysToExpiry;
        }
        if (a.status === "sent" && b.status === "draft") return -1;
        if (a.status === "draft" && b.status === "sent") return 1;
        return 0;
      });
      todoItems = fallbackSorted.slice(0, 5).map(toPublicTodoItem);
    } else {
      // Prendi le prime 5 dal filtro
      todoItems = sortedTodoItems.slice(0, 5).map(toPublicTodoItem);
    }

    // 6. RECENT EVENTS: Ultimi 8 eventi per company
    // Usa la stessa logica migliorata: ottieni eventi filtrati per company_id
    // Carica tutte le LOI della company per gli eventi
    const { data: allCompanyLois, error: allCompanyLoisError } = await supabase
      .from("fundops_lois")
      .select("id")
      .eq("company_id", companyId);

    if (allCompanyLoisError) {
      console.error("Error fetching all company LOIs for events:", allCompanyLoisError);
    }

    const companyLoiIdsForEvents = (allCompanyLois || []).map((l) => l.id);

    // Ottieni gli eventi per queste LOI
    let recentEvents: DashboardEventRow[] = [];
    if (companyLoiIdsForEvents.length > 0) {
      const { data, error: eventsError } = await supabase
        .from("fundops_loi_events")
        .select("id, loi_id, event_type, label, created_at")
        .in("loi_id", companyLoiIdsForEvents)
        .order("created_at", { ascending: false })
        .limit(8);

      if (eventsError) {
        console.error("Error fetching recent events:", eventsError);
      } else {
        recentEvents = (data ?? []) as DashboardEventRow[];
      }
    }

    // Arricchisci con loiTitle e investorName
    const loiIdsForEvents = Array.from(new Set(recentEvents.map((e) => e.loi_id)));
    
    let loisForEvents: DashboardLoiForEventRow[] = [];
    if (loiIdsForEvents.length > 0) {
      const { data } = await supabase
        .from("fundops_lois")
        .select("id, title, investor_id")
        .in("id", loiIdsForEvents);
      loisForEvents = (data ?? []) as DashboardLoiForEventRow[];
    }

    const loiMapForEvents = new Map(
      loisForEvents.map((l) => [l.id, { title: l.title, investorId: l.investor_id }])
    );

    // Estrai investor_ids unici e carica i nomi
    const investorIdsForEvents = Array.from(
      new Set(loisForEvents.map((l) => l.investor_id).filter(Boolean))
    );
    let investorsForEvents: InvestorNameRow[] = [];
    if (investorIdsForEvents.length > 0) {
      const { data } = await supabase
        .from("fundops_investors")
        .select("id, full_name")
        .in("id", investorIdsForEvents);
      investorsForEvents = (data ?? []) as InvestorNameRow[];
    }

    const investorMapForEvents = new Map(
      investorsForEvents.map((inv) => [inv.id, inv.full_name])
    );

    // Formatta gli eventi recenti secondo la shape richiesta
    const formattedEvents = recentEvents.map((event) => {
      const loiInfo = loiMapForEvents.get(event.loi_id);
      const investorId = loiInfo?.investorId;
      return {
        eventId: event.id,
        label: event.label || event.event_type,
        createdAt: event.created_at,
        loiId: event.loi_id,
        loiTitle: loiInfo?.title || null,
        investorName: investorId ? (investorMapForEvents.get(investorId) || null) : null,
      };
    });

    return NextResponse.json(
      {
        kpis: {
          pipelineTotal,
          committedTotal,
          expiringCount,
          remindersLast30Days,
        },
        todo: todoItems,
        recentEvents: formattedEvents,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("Error in dashboard API:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
