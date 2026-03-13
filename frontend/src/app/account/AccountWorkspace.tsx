"use client";

import Link from "next/link";
import { useState } from "react";
import AccountProfileForm from "./AccountProfileForm";
import styles from "./account.module.css";

type AccountSection = "overview" | "profile" | "preferences" | "security" | "access";

interface SeatSummary {
  companyId: string;
  companyName: string;
  role: string;
}

interface InvestorAccessSummary {
  companyId: string;
  companyName: string;
  lifecycleStage: string;
  isActive: boolean;
}

interface AccountWorkspaceProps {
  profileName: string;
  profileEmail: string;
  roleLabel: string;
  roleGlobal: string | null;
  areaLabel: string;
  avatarUrl: string | null;
  initialViewMode: "startup" | "investor";
  canSwitchViewMode: boolean;
  seatCount: number;
  adminSeatCount: number;
  memberSince: string | null;
  isActive: boolean;
  accountCreatedAt: string | null;
  lastSignIn: string | null;
  providerLabel: string;
  emailConfirmed: boolean;
  userId: string;
  profileUpdatedAt: string | null;
  firstInvestorLoginAt: string | null;
  disabledReason: string | null;
  disabledAt: string | null;
  seatSummary: SeatSummary[];
  investorAccessSummary: InvestorAccessSummary[];
}

const sectionCopy: Record<AccountSection, string> = {
  overview: "Vista generale del profilo, della sessione e dei tuoi accessi.",
  profile: "Dati identitari e riepilogo del profilo.",
  preferences: "Preferenze di ingresso e vista della piattaforma.",
  security: "Email di accesso e credenziali.",
  access: "Company collegate, ruoli e accessi lato supporter.",
};

export default function AccountWorkspace({
  profileName,
  profileEmail,
  roleLabel,
  roleGlobal,
  areaLabel,
  avatarUrl,
  initialViewMode,
  canSwitchViewMode,
  seatCount,
  adminSeatCount,
  memberSince,
  isActive,
  accountCreatedAt,
  lastSignIn,
  providerLabel,
  emailConfirmed,
  userId,
  profileUpdatedAt,
  firstInvestorLoginAt,
  disabledReason,
  disabledAt,
  seatSummary,
  investorAccessSummary,
}: AccountWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<AccountSection>("overview");
  const startupAccessCount = seatSummary.length;
  const supporterAccessCount = investorAccessSummary.length;
  const hasName = profileName.trim().length >= 2;
  const hasWorkEmail = profileEmail.includes("@");
  const profileHealthChecks = [
    hasName,
    hasWorkEmail,
    emailConfirmed,
    isActive,
    startupAccessCount + supporterAccessCount > 0,
  ];
  const profileHealthScore = Math.round(
    (profileHealthChecks.filter(Boolean).length / profileHealthChecks.length) * 100
  );
  const activityItems = [
    accountCreatedAt
      ? {
          id: "created",
          label: "Account creato",
          value: accountCreatedAt,
          tone: "neutral",
        }
      : null,
    memberSince
      ? {
          id: "profile",
          label: "Profilo attivato in piattaforma",
          value: memberSince,
          tone: "neutral",
        }
      : null,
    profileUpdatedAt
      ? {
          id: "updated",
          label: "Ultimo aggiornamento profilo",
          value: profileUpdatedAt,
          tone: "neutral",
        }
      : null,
    firstInvestorLoginAt
      ? {
          id: "supporter",
          label: "Primo accesso area supporter",
          value: firstInvestorLoginAt,
          tone: "accent",
        }
      : null,
    lastSignIn
      ? {
          id: "signin",
          label: "Ultimo accesso rilevato",
          value: lastSignIn,
          tone: "accent",
        }
      : null,
    disabledAt
      ? {
          id: "disabled",
          label: "Profilo disattivato",
          value: disabledAt,
          tone: "danger",
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    value: string;
    tone: "neutral" | "accent" | "danger";
  }>;
  const nextActions = [
    !emailConfirmed ? "Verifica l'email di accesso per rendere stabile il recupero account." : null,
    !hasName ? "Completa il nome profilo per una migliore leggibilita in sidebar e workflow." : null,
    startupAccessCount === 0 && supporterAccessCount === 0
      ? "Collega almeno una company o un accesso supporter per usare pienamente la piattaforma."
      : null,
    canSwitchViewMode ? "Imposta la vista di default che vuoi aprire per prima." : null,
  ].filter(Boolean) as string[];
  const canAccessAdmin = roleGlobal === "imment_admin";
  const canAccessStartup =
    roleGlobal === "imment_admin" ||
    roleGlobal === "imment_operator" ||
    roleGlobal === "founder";
  const canAccessSupporter = roleGlobal === "imment_admin" || roleGlobal === "investor";

  return (
    <section className={styles.workspace}>
      <div className={styles.sectionTabs}>
        {(["overview", "profile", "preferences", "security", "access"] as AccountSection[]).map((section) => (
          <button
            key={section}
            type="button"
            className={`${styles.sectionTab} ${activeSection === section ? styles.sectionTabActive : ""}`}
            onClick={() => setActiveSection(section)}
          >
            {section === "overview"
              ? "Overview"
              : section === "profile"
              ? "Profilo"
              : section === "preferences"
                ? "Preferenze"
                : section === "security"
                  ? "Sicurezza"
                  : "Accessi"}
          </button>
        ))}
      </div>

      <p className={styles.sectionIntro}>{sectionCopy[activeSection]}</p>

      <div className={styles.grid}>
        {(activeSection === "profile" ||
          activeSection === "preferences" ||
          activeSection === "security") && (
          <AccountProfileForm
            section={activeSection}
            initialFullName={profileName}
            email={profileEmail}
            avatarUrl={avatarUrl}
            roleLabel={roleLabel}
            areaLabel={areaLabel}
            initialViewMode={initialViewMode}
            canSwitchViewMode={canSwitchViewMode}
          />
        )}

        {activeSection === "overview" && (
          <>
            <article className={styles.card}>
              <p className={styles.cardLabel}>Overview account</p>
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiValue}>{seatCount}</span>
                  <span className={styles.kpiText}>company dirette</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiValue}>{adminSeatCount}</span>
                  <span className={styles.kpiText}>seat admin</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiValue}>
                    {investorAccessSummary.length}
                  </span>
                  <span className={styles.kpiText}>accessi supporter</span>
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <p className={styles.cardLabel}>Salute account</p>
              <div className={styles.healthHeader}>
                <div>
                  <p className={styles.healthScore}>{profileHealthScore}%</p>
                  <p className={styles.healthScoreLabel}>profilo completo e pronto all'uso</p>
                </div>
                <span
                  className={`${styles.statusBadge} ${
                    isActive ? styles.statusBadgeSuccess : styles.statusBadgeDanger
                  }`}
                >
                  {isActive ? "Attivo" : "Da verificare"}
                </span>
              </div>
              <div className={styles.healthChecklist}>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Nome profilo</span>
                  <span className={styles.healthItemValue}>{hasName ? "OK" : "Manca"}</span>
                </div>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Email account</span>
                  <span className={styles.healthItemValue}>{hasWorkEmail ? "OK" : "Manca"}</span>
                </div>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Email verificata</span>
                  <span className={styles.healthItemValue}>{emailConfirmed ? "Si" : "No"}</span>
                </div>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Accessi piattaforma</span>
                  <span className={styles.healthItemValue}>
                    {startupAccessCount + supporterAccessCount > 0 ? "Presenti" : "Assenti"}
                  </span>
                </div>
              </div>
              {!isActive && disabledReason && (
                <p className={styles.cardHelp}>Motivo disattivazione: {disabledReason}</p>
              )}
            </article>

            <article className={styles.card}>
              <p className={styles.cardLabel}>Sessione</p>
              <dl className={styles.definitionList}>
                <div>
                  <dt>User ID</dt>
                  <dd className={styles.codeValue}>{userId}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{providerLabel}</dd>
                </div>
                <div>
                  <dt>Email verificata</dt>
                  <dd>{emailConfirmed ? "Si" : "No"}</dd>
                </div>
                <div>
                  <dt>Account creato il</dt>
                  <dd>{accountCreatedAt ?? "-"}</dd>
                </div>
                <div>
                  <dt>Ultimo accesso</dt>
                  <dd>{lastSignIn ?? "-"}</dd>
                </div>
                <div>
                  <dt>Stato profilo</dt>
                  <dd>{isActive ? "Attivo" : "Disattivo"}</dd>
                </div>
              </dl>
            </article>

            <article className={styles.card}>
              <p className={styles.cardLabel}>Capacita del profilo</p>
              <div className={styles.healthChecklist}>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Area startup</span>
                  <span className={styles.healthItemValue}>{canAccessStartup ? "Abilitata" : "No"}</span>
                </div>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Area supporter</span>
                  <span className={styles.healthItemValue}>{canAccessSupporter ? "Abilitata" : "No"}</span>
                </div>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Pannello admin</span>
                  <span className={styles.healthItemValue}>{canAccessAdmin ? "Abilitato" : "No"}</span>
                </div>
                <div className={styles.healthItem}>
                  <span className={styles.healthItemLabel}>Switch vista</span>
                  <span className={styles.healthItemValue}>{canSwitchViewMode ? "Consentito" : "Bloccato"}</span>
                </div>
              </div>
            </article>

            <article className={styles.card}>
              <p className={styles.cardLabel}>Timeline account</p>
              {activityItems.length === 0 ? (
                <p className={styles.cardHelp}>Nessun evento disponibile per questo profilo.</p>
              ) : (
                <div className={styles.timeline}>
                  {activityItems.map((item) => (
                    <div key={item.id} className={styles.timelineItem}>
                      <span
                        className={`${styles.timelineDot} ${
                          item.tone === "danger"
                            ? styles.timelineDotDanger
                            : item.tone === "accent"
                              ? styles.timelineDotAccent
                              : styles.timelineDotNeutral
                        }`}
                        aria-hidden="true"
                      />
                      <div className={styles.timelineContent}>
                        <p className={styles.timelineTitle}>{item.label}</p>
                        <p className={styles.timelineMeta}>{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className={styles.card}>
              <p className={styles.cardLabel}>Azioni rapide</p>
              <div className={styles.actionGrid}>
                <Link href="/dashboard" className={styles.actionCard}>
                  <span className={styles.actionTitle}>Apri dashboard</span>
                  <span className={styles.actionMeta}>Torna alla vista operativa principale.</span>
                </Link>
                <Link href="/companies" className={styles.actionCard}>
                  <span className={styles.actionTitle}>Gestisci company</span>
                  <span className={styles.actionMeta}>Verifica seat e contesto startup disponibili.</span>
                </Link>
                <Link href="/account" className={styles.actionCard}>
                  <span className={styles.actionTitle}>Aggiorna account</span>
                  <span className={styles.actionMeta}>Rivedi profilo, preferenze e sicurezza.</span>
                </Link>
              </div>
              {nextActions.length > 0 && (
                <div className={styles.nextStepList}>
                  <p className={styles.nextStepLabel}>Prossimi passi consigliati</p>
                  {nextActions.map((item) => (
                    <div key={item} className={styles.nextStepItem}>
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </article>
          </>
        )}

        {activeSection === "profile" && (
          <article className={styles.card}>
            <p className={styles.cardLabel}>Profilo</p>
            <dl className={styles.definitionList}>
              <div>
                <dt>Nome</dt>
                <dd>{profileName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{profileEmail}</dd>
              </div>
              <div>
                <dt>Ruolo globale</dt>
                <dd>{roleLabel}</dd>
              </div>
              <div>
                <dt>Ruolo tecnico</dt>
                <dd>{roleGlobal ?? "-"}</dd>
              </div>
              <div>
                <dt>Vista attiva</dt>
                <dd>{areaLabel}</dd>
              </div>
              <div>
                <dt>Stato profilo</dt>
                <dd>{isActive ? "Attivo" : "Disattivo"}</dd>
              </div>
              <div>
                <dt>Membro dal</dt>
                <dd>{memberSince ?? "-"}</dd>
              </div>
              <div>
                <dt>Ultimo update profilo</dt>
                <dd>{profileUpdatedAt ?? "-"}</dd>
              </div>
              <div>
                <dt>Primo login supporter</dt>
                <dd>{firstInvestorLoginAt ?? "-"}</dd>
              </div>
              <div>
                <dt>Foto profilo</dt>
                <dd>{avatarUrl ? "Configurata" : "Non impostata"}</dd>
              </div>
            </dl>
            {!isActive && (
              <p className={styles.cardHelp}>
                Questo profilo risulta disattivato
                {disabledReason ? `: ${disabledReason}` : "."}
              </p>
            )}
          </article>
        )}

        {activeSection === "preferences" && (
          <article className={styles.card}>
            <p className={styles.cardLabel}>Accesso piattaforma</p>
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiValue}>{seatCount}</span>
                <span className={styles.kpiText}>company collegate</span>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiValue}>{adminSeatCount}</span>
                <span className={styles.kpiText}>seat admin</span>
              </div>
            </div>
            <p className={styles.cardHelp}>
              La vista attiva definisce quale area apri per prima. Solo i profili admin possono
              alternare liberamente Startup e Supporter.
            </p>
            <p className={styles.cardHelp}>
              Vista corrente: <strong>{areaLabel}</strong>
            </p>
          </article>
        )}

        {activeSection === "security" && (
          <article className={styles.card}>
            <p className={styles.cardLabel}>Postura sicurezza</p>
            <div className={styles.healthChecklist}>
              <div className={styles.healthItem}>
                <span className={styles.healthItemLabel}>Provider login</span>
                <span className={styles.healthItemValue}>{providerLabel}</span>
              </div>
              <div className={styles.healthItem}>
                <span className={styles.healthItemLabel}>Email verificata</span>
                <span className={styles.healthItemValue}>{emailConfirmed ? "Si" : "No"}</span>
              </div>
              <div className={styles.healthItem}>
                <span className={styles.healthItemLabel}>Ultimo accesso</span>
                <span className={styles.healthItemValue}>{lastSignIn ?? "-"}</span>
              </div>
              <div className={styles.healthItem}>
                <span className={styles.healthItemLabel}>Stato account</span>
                <span className={styles.healthItemValue}>{isActive ? "Attivo" : "Disattivato"}</span>
              </div>
            </div>
            <p className={styles.cardHelp}>
              Il cambio email puo richiedere conferma via mail. La password viene aggiornata
              direttamente sul profilo auth Supabase e conviene sceglierla lunga almeno 8 caratteri.
            </p>
          </article>
        )}

        {activeSection === "access" && (
          <>
            <article className={styles.card}>
              <p className={styles.cardLabel}>Mappa accessi</p>
              <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiValue}>{startupAccessCount}</span>
                  <span className={styles.kpiText}>accessi startup</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiValue}>{supporterAccessCount}</span>
                  <span className={styles.kpiText}>accessi supporter</span>
                </div>
              </div>
              <p className={styles.cardHelp}>
                Questa sezione mostra dove il profilo e collegato in piattaforma e con quale livello
                di accesso.
              </p>
            </article>

            <article className={styles.card}>
              <p className={styles.cardLabel}>Company dirette</p>
              {seatSummary.length === 0 ? (
                <p className={styles.cardHelp}>Nessuna company associata direttamente.</p>
              ) : (
                <div className={styles.accessList}>
                  {seatSummary.map((seat) => (
                    <div key={`${seat.companyId}-${seat.role}`} className={styles.accessRow}>
                      <div>
                        <p className={styles.accessTitle}>{seat.companyName}</p>
                        <p className={styles.accessMeta}>Role: {seat.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className={styles.card}>
              <p className={styles.cardLabel}>Accessi supporter</p>
              {investorAccessSummary.length === 0 ? (
                <p className={styles.cardHelp}>Nessun accesso lato supporter collegato a questo profilo.</p>
              ) : (
                <div className={styles.accessList}>
                  {investorAccessSummary.map((access) => (
                    <div key={`${access.companyId}-${access.lifecycleStage}`} className={styles.accessRow}>
                      <div>
                        <p className={styles.accessTitle}>{access.companyName}</p>
                        <p className={styles.accessMeta}>
                          Stage: {access.lifecycleStage} | {access.isActive ? "Attivo" : "Disattivo"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </>
        )}
      </div>
    </section>
  );
}
