-- Force RLS on ALL tenant data tables.
-- Without FORCE, the service_role key bypasses RLS entirely.
-- Tables already covered: profile, modules, finance_accounts, finance_categories,
-- finance_recurring, finance_transactions, calendar_events, calendar_attendees,
-- calendar_reminders, calendar_sync_config.

BEGIN;

-- ── Core ──────────────────────────────────────────────────────────────────────
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE entity_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE activity_log FORCE ROW LEVEL SECURITY;
ALTER TABLE integration_configs FORCE ROW LEVEL SECURITY;

-- ── Agent / Memory ────────────────────────────────────────────────────────────
ALTER TABLE agent_memories FORCE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries FORCE ROW LEVEL SECURITY;
ALTER TABLE session_archives FORCE ROW LEVEL SECURITY;
ALTER TABLE session_memories FORCE ROW LEVEL SECURITY;
ALTER TABLE cross_module_insights FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_status FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE tool_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE automation_configs FORCE ROW LEVEL SECURITY;

-- ── Finances (extras) ─────────────────────────────────────────────────────────
ALTER TABLE finance_budgets FORCE ROW LEVEL SECURITY;
ALTER TABLE finance_categorization_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE finance_net_worth_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE finance_transaction_splits FORCE ROW LEVEL SECURITY;

-- ── Health ────────────────────────────────────────────────────────────────────
ALTER TABLE health_observations FORCE ROW LEVEL SECURITY;
ALTER TABLE sleep_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE workout_sets FORCE ROW LEVEL SECURITY;
ALTER TABLE workout_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE workout_template_sets FORCE ROW LEVEL SECURITY;
ALTER TABLE body_measurements FORCE ROW LEVEL SECURITY;
ALTER TABLE exercises FORCE ROW LEVEL SECURITY;
ALTER TABLE conditions FORCE ROW LEVEL SECURITY;
ALTER TABLE medications FORCE ROW LEVEL SECURITY;
ALTER TABLE medication_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE lab_results FORCE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE substance_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE habit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE habits FORCE ROW LEVEL SECURITY;
ALTER TABLE data_gaps FORCE ROW LEVEL SECURITY;

-- ── People / CRM ──────────────────────────────────────────────────────────────
ALTER TABLE people FORCE ROW LEVEL SECURITY;
ALTER TABLE interactions FORCE ROW LEVEL SECURITY;
ALTER TABLE special_dates FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_reminders FORCE ROW LEVEL SECURITY;
ALTER TABLE people_relationships FORCE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

-- ── Career ────────────────────────────────────────────────────────────────────
ALTER TABLE career_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE career_experiences FORCE ROW LEVEL SECURITY;
ALTER TABLE career_educations FORCE ROW LEVEL SECURITY;
ALTER TABLE career_certifications FORCE ROW LEVEL SECURITY;
ALTER TABLE career_skills FORCE ROW LEVEL SECURITY;
ALTER TABLE work_logs FORCE ROW LEVEL SECURITY;

-- ── Objectives / Routine ──────────────────────────────────────────────────────
ALTER TABLE objectives FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE task_objectives FORCE ROW LEVEL SECURITY;
ALTER TABLE cycles FORCE ROW LEVEL SECURITY;
ALTER TABLE cycle_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

-- ── Legal ─────────────────────────────────────────────────────────────────────
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE contract_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE contract_signatories FORCE ROW LEVEL SECURITY;
ALTER TABLE legal_entities FORCE ROW LEVEL SECURITY;
ALTER TABLE legal_obligations FORCE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_types FORCE ROW LEVEL SECURITY;
ALTER TABLE document_processing_queue FORCE ROW LEVEL SECURITY;

-- ── Assets / Housing ──────────────────────────────────────────────────────────
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE portfolio_quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE residences FORCE ROW LEVEL SECURITY;
ALTER TABLE housing_bills FORCE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs FORCE ROW LEVEL SECURITY;

-- ── Entertainment ─────────────────────────────────────────────────────────────
ALTER TABLE media_items FORCE ROW LEVEL SECURITY;
ALTER TABLE books FORCE ROW LEVEL SECURITY;
ALTER TABLE hobby_logs FORCE ROW LEVEL SECURITY;

-- ── Knowledge / Journal ───────────────────────────────────────────────────────
ALTER TABLE knowledge_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_collections FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_note_collections FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_processing_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE note_relations FORCE ROW LEVEL SECURITY;
ALTER TABLE reflections FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;

-- ── Social / Spirituality ─────────────────────────────────────────────────────
ALTER TABLE social_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE social_goals FORCE ROW LEVEL SECURITY;
ALTER TABLE personal_values FORCE ROW LEVEL SECURITY;

-- ── Security ──────────────────────────────────────────────────────────────────
ALTER TABLE security_items FORCE ROW LEVEL SECURITY;

-- ── Calendar (extras) ─────────────────────────────────────────────────────────
ALTER TABLE event_types FORCE ROW LEVEL SECURITY;
ALTER TABLE availability_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE availability_slots FORCE ROW LEVEL SECURITY;
ALTER TABLE availability_date_overrides FORCE ROW LEVEL SECURITY;

-- ── Workspace / Demands / Extensions ──────────────────────────────────────────
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE demands FORCE ROW LEVEL SECURITY;
ALTER TABLE demand_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE demand_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE demand_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE extension_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE onboarding_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE archiving_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE entity_activity_log FORCE ROW LEVEL SECURITY;

-- ── ClickUp / GitHub ──────────────────────────────────────────────────────────
ALTER TABLE clickup_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE github_repos FORCE ROW LEVEL SECURITY;
ALTER TABLE github_pull_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE issue_labels FORCE ROW LEVEL SECURITY;
ALTER TABLE issue_states FORCE ROW LEVEL SECURITY;

COMMIT;
