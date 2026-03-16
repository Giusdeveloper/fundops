## Companies and Startup Profiling

### Context
- `Founders` and `operators` that are already mapped to a company (e.g., `info@imment.it` for Imment or Giuseppe for GP System) arrive at FundOps with an active tenant. In that case the current `/companies` page becomes redundant unless it is re–imagined as an explicit onboarding step to describe the startup.
- We discussed turning `/companies` into a profiling surface (survey) that captures high–level information (team, traction, round stage) as part of the company creation flow. The same data feed will later serve the AI-based *Startup Scoring* feature.

### Short-term options
1. **Adaptive surface:** show `/companies` only when the logged-in user has no active company; redirect founders/operators straight to the dashboard when `activeCompanyId` is set. The page remains available but is now targeted at the “create my company” use case.
2. **Profiling survey:** keep `/companies` for tenants that still need to describe their startup. The survey fields should capture the same metadata we later feed to the scoring engine (vertical, traction, KPIs, priorities). Store answers on the company record or a dedicated table so we can reuse them.

### Survey-to-schema translation
Use the Startup Scoring form as the source of truth for the profile schema. Group questions into these clusters:
1. **Founder / Contact info**
   - `founder_first_name`, `founder_last_name`, `founder_email`, `founder_phone`, `founder_linkedin`
   - retain one-to-many relation if founders >1 (structured as `founder_profiles` table or JSON array)
2. **Company identity**
   - `company_name`, `sector`, `description`
   - `value_proposition` text and tags for verticals (mapped from `Settore`)
3. **Capital & CTA**
   - `funds_raised_bucket` (enum: matching ranges listed in the form)
   - `funding_channels` (array of selected options: Club Deal, Business Angel, …)
   - `cap_table_structure` text field
   - `funding_target_amount`
   - `funding_use_cases` (multi-select matching choices like Marketing, Team, Ricerca, ecc.)
4. **Traction metrics**
   - numeric KPIs: `revenue`, `cac`, `mrr`, `growth_rate`, `active_customers`, `gross_margin`, `ltv`, `nps`, `churn_rate`
   - `traction_note` free text
5. **Team maturity**
   - `co_founder_count`, `founder_experience_years_sector`, `founder_experience_years_startups`, `founder_relationship_years`, `founder_commitment_hours`
6. **Capabilities**
  - `self_served_services` array (selected from the list: Sviluppo, Marketing, Team, Ricerca, Espansione, Operazioni, Debiti, Tecnologia, Altro)
7. **Attachments**
  - `investor_deck_url` and `company_registry_url`

Design the persistence layer as a `company_profiles` table with FK to `fundops_companies` and JSON columns for multi-values (`funding_channels`, `self_served_services`). This schema will feed the Startup Scoring pipeline later.

### Shared attachments API/view
Treat the “Attachments” bucket as a shared asset between `/companies` and `/dossier`:
1. Persist every upload with metadata (`type`=deck|registry, `url`, `uploaded_by`, `uploaded_at`, `source="profiling"`) either in `company_profiles.attachments` or a dedicated `company_profile_attachments` table indexed by `company_id`.
2. Provide an upload API (`POST /api/company-profiles/attachments`) that writes the metadata and returns the current attachment list; invoke it from both the companies profiling UI and the dossier upload flow.
3. In `/companies`, render an “Allegati profilazione” section showing deck/visura status, links and edit CTA. In `/dossier`, add a “Documenti startup” card that references the same URLs and highlights “caricato da profilazione” so compliance sees the origin.
4. Once the attachment store exists, update both views automatically whenever a new file is uploaded so the founder and the dossier team stay in sync.

### Future plan – Startup Scoring
1. **Data handoff:** the profiling answers feed an AI scoring pipeline (`scoreStartup(companyId)`), which can run on demand or via background job and derive metrics like “market readiness” and “capital appetite.”
2. **User experience:** surface the scoring result in dashboard KPI cards (health indicator, top risks) and in tutorial/next-action hints (“Add a LOI to improve your readiness score”). Keep the survey accessible from `/companies`, `/account`, or a dedicated wizard so founders can update their profile over time.
3. **AI integration:** consider leveraging GPT‑style prompts plus company data to generate narratives (summary + recommendations). The scoring output can also drive experimentation (e.g., highlight field coaching content when score drops).

Document the decision path in future tickets and link back to this note when the team implements the Startup Scoring flow.
