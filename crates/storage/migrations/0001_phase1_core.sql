PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  position_x REAL,
  position_y REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (source_id) REFERENCES nodes(id),
  FOREIGN KEY (target_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS node_notes (
  node_id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS node_execution_metadata (
  node_id TEXT PRIMARY KEY,
  energy_level INTEGER,
  friction_level INTEGER,
  estimated_minutes INTEGER,
  minimum_done TEXT,
  context_tags TEXT NOT NULL DEFAULT '',
  last_started_at TEXT,
  last_checked_in_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS support_templates (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  steps TEXT NOT NULL,
  default_contexts TEXT NOT NULL,
  source_note TEXT NOT NULL,
  safety_note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_experiments (
  id TEXT PRIMARY KEY,
  support_template_id TEXT,
  custom_support_title TEXT,
  context TEXT NOT NULL,
  helped_start INTEGER NOT NULL,
  helped_continue INTEGER NOT NULL,
  helped_return INTEGER NOT NULL,
  helped_clarify_next_action INTEGER NOT NULL,
  obstacle_note TEXT,
  next_decision TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attention_sessions (
  id TEXT PRIMARY KEY,
  start_plan_id TEXT,
  next_action_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  intended_duration_minutes INTEGER,
  state TEXT NOT NULL,
  completion_note TEXT
);

CREATE TABLE IF NOT EXISTS ai_proposals (
  id TEXT PRIMARY KEY,
  proposal_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  node_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS context_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  adult_contexts TEXT NOT NULL DEFAULT '',
  execution_difficulties TEXT NOT NULL DEFAULT '',
  preferred_support_categories TEXT NOT NULL DEFAULT '',
  llm_provider_setup_state TEXT NOT NULL DEFAULT 'not_configured',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS agent_threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS agent_turns (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  agent_response TEXT NOT NULL,
  prompt_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES agent_threads(id)
);

CREATE TABLE IF NOT EXISTS agent_previews (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  status TEXT NOT NULL,
  user_visible_summary TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_skill_runs (
  id TEXT PRIMARY KEY,
  turn_id TEXT,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  result_status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preference_memory (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  memory_text TEXT NOT NULL,
  evidence_reference TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL,
  version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
