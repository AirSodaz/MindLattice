use std::path::Path;

use mindlattice_core::domain::{
    AgentSkillRun, AgentThread, AgentTurn, AiProposalRecord, AiProposalStatus, AttentionSession,
    AttentionSessionState, CheckIn, ContextProfile, EdgeKind, GraphEdge, GraphNode, MapSnapshot,
    MemoryProposal, NodeExecutionMetadata, NodeKind, NodeNote, NodePosition, PromptVersionRecord,
    Workspace,
};
use mindlattice_core::proposals::validate_memory_proposal;
use mindlattice_core::proposals::{
    validate_agent_preview, AgentPreview, ProposedEdge, ProposedNode,
};
use mindlattice_core::safety::SafetyReview;
use mindlattice_core::strategies::{
    validate_context_profile, validate_strategy_experiment, ExperimentContext, StrategyDecision,
    StrategyExperiment, StrategyValidationError, SupportCategory,
};
use rusqlite::{params, Connection};

#[derive(Debug)]
pub enum RepositoryError {
    Sqlite(rusqlite::Error),
    InvalidNodeKind(String),
    InvalidEdgeKind(String),
    InvalidExperimentContext(String),
    InvalidStrategyDecision(String),
    InvalidAttentionSessionState(String),
    InvalidStrategyExperiment(StrategyValidationError),
    InvalidContextProfile(StrategyValidationError),
    InvalidMemoryProposal(SafetyReview),
    InvalidAgentPreview(SafetyReview),
    InvalidPreviewPayload(String),
    InvalidAiProposalStatus(String),
    WorkspaceNotFound(String),
    NodeNotFound(String),
    EdgeNotFound(String),
    ContextProfileNotFound(String),
    AttentionSessionNotFound(String),
}

impl From<rusqlite::Error> for RepositoryError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sqlite(value)
    }
}

pub struct MindLatticeRepository {
    conn: Connection,
}

impl MindLatticeRepository {
    pub fn open_in_memory() -> Result<Self, RepositoryError> {
        Ok(Self {
            conn: Connection::open_in_memory()?,
        })
    }

    pub fn open_file(path: impl AsRef<Path>) -> Result<Self, RepositoryError> {
        Ok(Self {
            conn: Connection::open(path)?,
        })
    }

    pub fn migrate(&self) -> Result<(), RepositoryError> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )?;
        self.conn
            .execute_batch(include_str!("../migrations/0001_phase1_core.sql"))?;
        self.ensure_column(
            "agent_previews",
            "payload_json",
            "ALTER TABLE agent_previews ADD COLUMN payload_json TEXT NOT NULL DEFAULT ''",
        )?;
        self.conn.execute(
            "INSERT OR IGNORE INTO schema_migrations (version) VALUES (?1)",
            params!["0001_phase1_core"],
        )?;
        Ok(())
    }

    fn ensure_column(
        &self,
        table_name: &str,
        column_name: &str,
        alter_sql: &str,
    ) -> Result<(), RepositoryError> {
        let mut stmt = self
            .conn
            .prepare(&format!("PRAGMA table_info({table_name})"))?;
        let existing_columns = stmt.query_map([], |row| row.get::<_, String>(1))?;
        for existing_column in existing_columns {
            if existing_column? == column_name {
                return Ok(());
            }
        }
        self.conn.execute(alter_sql, [])?;
        Ok(())
    }

    pub fn table_names(&self) -> Result<Vec<String>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn applied_migrations(&self) -> Result<Vec<String>, RepositoryError> {
        let mut stmt = self
            .conn
            .prepare("SELECT version FROM schema_migrations ORDER BY version")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn upsert_workspace(&self, workspace: &Workspace) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO workspaces (id, title)
            VALUES (?1, ?2)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              updated_at = CURRENT_TIMESTAMP
            "#,
            params![workspace.id, workspace.title],
        )?;
        Ok(())
    }

    pub fn upsert_node(&self, node: &GraphNode) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO nodes (id, workspace_id, kind, title, body, position_x, position_y)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              kind = excluded.kind,
              title = excluded.title,
              body = excluded.body,
              position_x = excluded.position_x,
              position_y = excluded.position_y,
              updated_at = CURRENT_TIMESTAMP
            "#,
            params![
                node.id,
                node.workspace_id,
                node.kind.as_str(),
                node.title,
                node.body,
                node.position.as_ref().map(|position| position.x),
                node.position.as_ref().map(|position| position.y),
            ],
        )?;

        if let Some(metadata) = &node.metadata {
            self.upsert_node_metadata(&node.id, metadata)?;
        }

        Ok(())
    }

    pub fn node(&self, node_id: &str) -> Result<GraphNode, RepositoryError> {
        let row = self
            .conn
            .query_row(
                r#"
                SELECT n.id, n.workspace_id, n.kind, n.title, n.body, n.position_x, n.position_y,
                       m.energy_level, m.friction_level, m.estimated_minutes,
                       m.minimum_done, m.context_tags, m.last_started_at, m.last_checked_in_at
                FROM nodes n
                LEFT JOIN node_execution_metadata m ON m.node_id = n.id
                WHERE n.id = ?1 AND n.deleted_at IS NULL
                "#,
                params![node_id],
                node_row_from_sql,
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    RepositoryError::NodeNotFound(node_id.to_string())
                }
                other => RepositoryError::Sqlite(other),
            })?;
        graph_node_from_row(row)
    }

    pub fn upsert_edge(
        &self,
        id: &str,
        workspace_id: &str,
        source_id: &str,
        target_id: &str,
        kind: EdgeKind,
    ) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO edges (id, workspace_id, source_id, target_id, kind)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              source_id = excluded.source_id,
              target_id = excluded.target_id,
              kind = excluded.kind,
              updated_at = CURRENT_TIMESTAMP
            "#,
            params![id, workspace_id, source_id, target_id, kind.as_str()],
        )?;
        Ok(())
    }

    pub fn delete_edge(&self, edge_id: &str) -> Result<(), RepositoryError> {
        let changed = self.conn.execute(
            r#"
            UPDATE edges
            SET deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1 AND deleted_at IS NULL
            "#,
            params![edge_id],
        )?;
        if changed == 0 {
            return Err(RepositoryError::EdgeNotFound(edge_id.to_string()));
        }
        Ok(())
    }

    pub fn delete_node(&self, node_id: &str) -> Result<(), RepositoryError> {
        let changed = self.conn.execute(
            r#"
            UPDATE nodes
            SET deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1 AND deleted_at IS NULL
            "#,
            params![node_id],
        )?;
        if changed == 0 {
            return Err(RepositoryError::NodeNotFound(node_id.to_string()));
        }
        self.conn.execute(
            r#"
            UPDATE edges
            SET deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE deleted_at IS NULL
              AND (source_id = ?1 OR target_id = ?1)
            "#,
            params![node_id],
        )?;
        Ok(())
    }

    pub fn map_snapshot(&self, workspace_id: &str) -> Result<MapSnapshot, RepositoryError> {
        let workspace = self
            .conn
            .query_row(
                "SELECT id, title FROM workspaces WHERE id = ?1",
                params![workspace_id],
                |row| {
                    Ok(Workspace {
                        id: row.get(0)?,
                        title: row.get(1)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    RepositoryError::WorkspaceNotFound(workspace_id.to_string())
                }
                other => RepositoryError::Sqlite(other),
            })?;

        let mut node_stmt = self.conn.prepare(
            r#"
            SELECT n.id, n.workspace_id, n.kind, n.title, n.body, n.position_x, n.position_y,
                   m.energy_level, m.friction_level, m.estimated_minutes,
                   m.minimum_done, m.context_tags, m.last_started_at, m.last_checked_in_at
            FROM nodes n
            LEFT JOIN node_execution_metadata m ON m.node_id = n.id
            WHERE n.workspace_id = ?1 AND n.deleted_at IS NULL
            ORDER BY n.created_at, n.id
            "#,
        )?;
        let node_rows = node_stmt.query_map(params![workspace_id], node_row_from_sql)?;

        let nodes = node_rows
            .map(|row| graph_node_from_row(row?))
            .collect::<Result<Vec<_>, RepositoryError>>()?;

        let mut edge_stmt = self.conn.prepare(
            r#"
            SELECT id, workspace_id, source_id, target_id, kind
            FROM edges
            WHERE workspace_id = ?1 AND deleted_at IS NULL
            ORDER BY created_at, id
            "#,
        )?;
        let edge_rows = edge_stmt.query_map(params![workspace_id], |row| {
            Ok(EdgeRow {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                source_id: row.get(2)?,
                target_id: row.get(3)?,
                kind: row.get(4)?,
            })
        })?;

        let edges = edge_rows
            .map(|row| {
                let row = row?;
                let kind = EdgeKind::from_str(&row.kind)
                    .ok_or_else(|| RepositoryError::InvalidEdgeKind(row.kind.clone()))?;
                Ok(GraphEdge {
                    id: row.id,
                    workspace_id: row.workspace_id,
                    source_id: row.source_id,
                    target_id: row.target_id,
                    kind,
                })
            })
            .collect::<Result<Vec<_>, RepositoryError>>()?;

        Ok(MapSnapshot {
            workspace,
            nodes,
            edges,
        })
    }

    pub fn record_strategy_experiment(
        &self,
        experiment: &StrategyExperiment,
    ) -> Result<(), RepositoryError> {
        validate_strategy_experiment(experiment)
            .map_err(RepositoryError::InvalidStrategyExperiment)?;
        self.conn.execute(
            r#"
            INSERT INTO strategy_experiments (
              id,
              support_template_id,
              custom_support_title,
              context,
              helped_start,
              helped_continue,
              helped_return,
              helped_clarify_next_action,
              obstacle_note,
              next_decision
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
              support_template_id = excluded.support_template_id,
              custom_support_title = excluded.custom_support_title,
              context = excluded.context,
              helped_start = excluded.helped_start,
              helped_continue = excluded.helped_continue,
              helped_return = excluded.helped_return,
              helped_clarify_next_action = excluded.helped_clarify_next_action,
              obstacle_note = excluded.obstacle_note,
              next_decision = excluded.next_decision
            "#,
            params![
                experiment.id,
                experiment.support_template_id,
                experiment.custom_support_title,
                experiment.context.as_str(),
                experiment.helped_start,
                experiment.helped_continue,
                experiment.helped_return,
                experiment.helped_clarify_next_action,
                experiment.obstacle_note,
                experiment.next_decision.as_str(),
            ],
        )?;
        Ok(())
    }

    pub fn strategy_experiments(&self) -> Result<Vec<StrategyExperiment>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, support_template_id, custom_support_title, context,
                   helped_start, helped_continue, helped_return,
                   helped_clarify_next_action, obstacle_note, next_decision
            FROM strategy_experiments
            ORDER BY created_at, id
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ExperimentRow {
                id: row.get(0)?,
                support_template_id: row.get(1)?,
                custom_support_title: row.get(2)?,
                context: row.get(3)?,
                helped_start: row.get(4)?,
                helped_continue: row.get(5)?,
                helped_return: row.get(6)?,
                helped_clarify_next_action: row.get(7)?,
                obstacle_note: row.get(8)?,
                next_decision: row.get(9)?,
            })
        })?;

        rows.map(|row| {
            let row = row?;
            Ok(StrategyExperiment {
                id: row.id,
                support_template_id: row.support_template_id,
                custom_support_title: row.custom_support_title,
                context: ExperimentContext::from_str(&row.context).ok_or_else(|| {
                    RepositoryError::InvalidExperimentContext(row.context.clone())
                })?,
                helped_start: row.helped_start,
                helped_continue: row.helped_continue,
                helped_return: row.helped_return,
                helped_clarify_next_action: row.helped_clarify_next_action,
                obstacle_note: row.obstacle_note,
                next_decision: StrategyDecision::from_str(&row.next_decision).ok_or_else(|| {
                    RepositoryError::InvalidStrategyDecision(row.next_decision.clone())
                })?,
            })
        })
        .collect()
    }

    pub fn upsert_context_profile(&self, profile: &ContextProfile) -> Result<(), RepositoryError> {
        validate_context_profile(profile).map_err(RepositoryError::InvalidContextProfile)?;
        self.conn.execute(
            r#"
            INSERT INTO context_profiles (
              id,
              workspace_id,
              adult_contexts,
              execution_difficulties,
              preferred_support_categories,
              llm_provider_setup_state
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              adult_contexts = excluded.adult_contexts,
              execution_difficulties = excluded.execution_difficulties,
              preferred_support_categories = excluded.preferred_support_categories,
              llm_provider_setup_state = excluded.llm_provider_setup_state,
              updated_at = CURRENT_TIMESTAMP
            "#,
            params![
                profile.id,
                profile.workspace_id,
                join_tags(&profile.adult_contexts),
                join_tags(&profile.execution_difficulties),
                join_support_categories(&profile.preferred_support_categories),
                profile.llm_provider_setup_state,
            ],
        )?;
        Ok(())
    }

    pub fn context_profile(&self, workspace_id: &str) -> Result<ContextProfile, RepositoryError> {
        let row = self
            .conn
            .query_row(
                r#"
                SELECT id, workspace_id, adult_contexts, execution_difficulties,
                       preferred_support_categories, llm_provider_setup_state
                FROM context_profiles
                WHERE workspace_id = ?1
                ORDER BY updated_at DESC, id
                LIMIT 1
                "#,
                params![workspace_id],
                |row| {
                    Ok(ContextProfileRow {
                        id: row.get(0)?,
                        workspace_id: row.get(1)?,
                        adult_contexts: row.get(2)?,
                        execution_difficulties: row.get(3)?,
                        preferred_support_categories: row.get(4)?,
                        llm_provider_setup_state: row.get(5)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    RepositoryError::ContextProfileNotFound(workspace_id.to_string())
                }
                other => RepositoryError::Sqlite(other),
            })?;

        let preferred_support_categories = split_tags(row.preferred_support_categories)
            .into_iter()
            .map(|category| {
                SupportCategory::from_str(&category)
                    .ok_or_else(|| RepositoryError::InvalidExperimentContext(category.clone()))
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(ContextProfile {
            id: row.id,
            workspace_id: row.workspace_id,
            adult_contexts: split_tags(row.adult_contexts),
            execution_difficulties: split_tags(row.execution_difficulties),
            preferred_support_categories,
            llm_provider_setup_state: row.llm_provider_setup_state,
        })
    }

    pub fn upsert_attention_session(
        &self,
        session: &AttentionSession,
    ) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO attention_sessions (
              id,
              start_plan_id,
              next_action_id,
              started_at,
              ended_at,
              intended_duration_minutes,
              state,
              completion_note
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
              start_plan_id = excluded.start_plan_id,
              next_action_id = excluded.next_action_id,
              started_at = excluded.started_at,
              ended_at = excluded.ended_at,
              intended_duration_minutes = excluded.intended_duration_minutes,
              state = excluded.state,
              completion_note = excluded.completion_note
            "#,
            params![
                session.id,
                session.start_plan_id,
                session.next_action_id,
                session.started_at,
                session.ended_at,
                session.intended_duration_minutes,
                session.state.as_str(),
                session.completion_note,
            ],
        )?;
        Ok(())
    }

    pub fn attention_sessions(&self) -> Result<Vec<AttentionSession>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, start_plan_id, next_action_id, started_at, ended_at,
                   intended_duration_minutes, state, completion_note
            FROM attention_sessions
            ORDER BY started_at, id
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(AttentionSessionRow {
                id: row.get(0)?,
                start_plan_id: row.get(1)?,
                next_action_id: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
                intended_duration_minutes: row.get(5)?,
                state: row.get(6)?,
                completion_note: row.get(7)?,
            })
        })?;

        rows.map(|row| attention_session_from_row(row?)).collect()
    }

    pub fn attention_session(&self, session_id: &str) -> Result<AttentionSession, RepositoryError> {
        self.conn
            .query_row(
                r#"
                SELECT id, start_plan_id, next_action_id, started_at, ended_at,
                       intended_duration_minutes, state, completion_note
                FROM attention_sessions
                WHERE id = ?1
                "#,
                params![session_id],
                |row| {
                    Ok(AttentionSessionRow {
                        id: row.get(0)?,
                        start_plan_id: row.get(1)?,
                        next_action_id: row.get(2)?,
                        started_at: row.get(3)?,
                        ended_at: row.get(4)?,
                        intended_duration_minutes: row.get(5)?,
                        state: row.get(6)?,
                        completion_note: row.get(7)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => {
                    RepositoryError::AttentionSessionNotFound(session_id.to_string())
                }
                other => RepositoryError::Sqlite(other),
            })
            .and_then(attention_session_from_row)
    }

    pub fn accept_memory_proposal(
        &self,
        workspace_id: &str,
        proposal: &MemoryProposal,
    ) -> Result<(), RepositoryError> {
        validate_memory_proposal(proposal).map_err(RepositoryError::InvalidMemoryProposal)?;
        self.conn.execute(
            r#"
            INSERT INTO preference_memory (
              id,
              workspace_id,
              memory_text,
              evidence_reference,
              enabled
            )
            VALUES (?1, ?2, ?3, ?4, 1)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              memory_text = excluded.memory_text,
              evidence_reference = excluded.evidence_reference,
              enabled = 1,
              updated_at = CURRENT_TIMESTAMP,
              deleted_at = NULL
            "#,
            params![
                proposal.id,
                workspace_id,
                proposal.proposed_memory_text,
                proposal.evidence_reference,
            ],
        )?;
        Ok(())
    }

    pub fn preference_memory(
        &self,
        workspace_id: &str,
    ) -> Result<Vec<MemoryProposal>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, memory_text, evidence_reference
            FROM preference_memory
            WHERE workspace_id = ?1 AND enabled = 1 AND deleted_at IS NULL
            ORDER BY created_at, id
            "#,
        )?;
        let rows = stmt.query_map(params![workspace_id], |row| {
            Ok(MemoryProposal {
                id: row.get(0)?,
                proposed_memory_text: row.get(1)?,
                evidence_reference: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn delete_preference_memory(
        &self,
        workspace_id: &str,
        memory_id: &str,
    ) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            UPDATE preference_memory
            SET enabled = 0,
                deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE workspace_id = ?1 AND id = ?2
            "#,
            params![workspace_id, memory_id],
        )?;
        Ok(())
    }

    pub fn upsert_node_note(&self, note: &NodeNote) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO node_notes (node_id, body)
            VALUES (?1, ?2)
            ON CONFLICT(node_id) DO UPDATE SET
              body = excluded.body,
              updated_at = CURRENT_TIMESTAMP
            "#,
            params![note.node_id, note.body],
        )?;
        Ok(())
    }

    pub fn node_note(&self, node_id: &str) -> Result<Option<NodeNote>, RepositoryError> {
        let result = self.conn.query_row(
            "SELECT node_id, body FROM node_notes WHERE node_id = ?1",
            params![node_id],
            |row| {
                Ok(NodeNote {
                    node_id: row.get(0)?,
                    body: row.get(1)?,
                })
            },
        );
        match result {
            Ok(note) => Ok(Some(note)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(RepositoryError::Sqlite(error)),
        }
    }

    pub fn upsert_ai_proposal(&self, proposal: &AiProposalRecord) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO ai_proposals (id, proposal_type, status)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET
              proposal_type = excluded.proposal_type,
              status = excluded.status
            "#,
            params![
                proposal.id,
                proposal.proposal_type,
                proposal.status.as_str(),
            ],
        )?;
        Ok(())
    }

    pub fn ai_proposals(&self) -> Result<Vec<AiProposalRecord>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, proposal_type, status
            FROM ai_proposals
            ORDER BY created_at, rowid
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(AiProposalRow {
                id: row.get(0)?,
                proposal_type: row.get(1)?,
                status: row.get(2)?,
            })
        })?;

        rows.map(|row| {
            let row = row?;
            let status = AiProposalStatus::from_str(&row.status)
                .ok_or_else(|| RepositoryError::InvalidAiProposalStatus(row.status.clone()))?;
            Ok(AiProposalRecord {
                id: row.id,
                proposal_type: row.proposal_type,
                status,
            })
        })
        .collect()
    }

    pub fn upsert_agent_thread(&self, thread: &AgentThread) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO agent_threads (id, workspace_id, title)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              title = excluded.title
            "#,
            params![thread.id, thread.workspace_id, thread.title],
        )?;
        Ok(())
    }

    pub fn agent_threads(&self, workspace_id: &str) -> Result<Vec<AgentThread>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, workspace_id, title
            FROM agent_threads
            WHERE workspace_id = ?1
            ORDER BY created_at, rowid
            "#,
        )?;
        let rows = stmt.query_map(params![workspace_id], |row| {
            Ok(AgentThread {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                title: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn insert_agent_turn(&self, turn: &AgentTurn) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO agent_turns (
              id,
              thread_id,
              user_message,
              agent_response,
              prompt_version_id
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET
              thread_id = excluded.thread_id,
              user_message = excluded.user_message,
              agent_response = excluded.agent_response,
              prompt_version_id = excluded.prompt_version_id
            "#,
            params![
                turn.id,
                turn.thread_id,
                turn.user_message,
                turn.agent_response,
                turn.prompt_version_id,
            ],
        )?;
        Ok(())
    }

    pub fn agent_turns(&self, thread_id: &str) -> Result<Vec<AgentTurn>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, thread_id, user_message, agent_response, prompt_version_id
            FROM agent_turns
            WHERE thread_id = ?1
            ORDER BY created_at, rowid
            "#,
        )?;
        let rows = stmt.query_map(params![thread_id], |row| {
            Ok(AgentTurn {
                id: row.get(0)?,
                thread_id: row.get(1)?,
                user_message: row.get(2)?,
                agent_response: row.get(3)?,
                prompt_version_id: row.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn insert_agent_skill_run(&self, run: &AgentSkillRun) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO agent_skill_runs (
              id,
              turn_id,
              skill_id,
              skill_version,
              result_status
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET
              turn_id = excluded.turn_id,
              skill_id = excluded.skill_id,
              skill_version = excluded.skill_version,
              result_status = excluded.result_status
            "#,
            params![
                run.id,
                run.turn_id,
                run.skill_id,
                run.skill_version,
                run.result_status,
            ],
        )?;
        Ok(())
    }

    pub fn agent_skill_runs(&self, turn_id: &str) -> Result<Vec<AgentSkillRun>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, turn_id, skill_id, skill_version, result_status
            FROM agent_skill_runs
            WHERE turn_id = ?1
            ORDER BY created_at, rowid
            "#,
        )?;
        let rows = stmt.query_map(params![turn_id], |row| {
            Ok(AgentSkillRun {
                id: row.get(0)?,
                turn_id: row.get(1)?,
                skill_id: row.get(2)?,
                skill_version: row.get(3)?,
                result_status: row.get(4)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn upsert_prompt_version(
        &self,
        record: &PromptVersionRecord,
    ) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO prompt_versions (id, layer, version, content_hash)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(id) DO UPDATE SET
              layer = excluded.layer,
              version = excluded.version,
              content_hash = excluded.content_hash
            "#,
            params![record.id, record.layer, record.version, record.content_hash,],
        )?;
        Ok(())
    }

    pub fn prompt_versions(&self) -> Result<Vec<PromptVersionRecord>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, layer, version, content_hash
            FROM prompt_versions
            ORDER BY created_at, rowid
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PromptVersionRecord {
                id: row.get(0)?,
                layer: row.get(1)?,
                version: row.get(2)?,
                content_hash: row.get(3)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn upsert_agent_preview(&self, preview: &AgentPreview) -> Result<(), RepositoryError> {
        self.upsert_agent_preview_for_thread(preview, None)
    }

    pub fn upsert_agent_preview_for_thread(
        &self,
        preview: &AgentPreview,
        thread_id: Option<&str>,
    ) -> Result<(), RepositoryError> {
        let review = validate_agent_preview(preview);
        if review.status != mindlattice_core::safety::SafetyStatus::Allowed {
            return Err(RepositoryError::InvalidAgentPreview(review));
        }
        let payload_json = serde_json::to_string(preview)
            .map_err(|_| RepositoryError::InvalidPreviewPayload(preview.id.clone()))?;
        self.conn.execute(
            r#"
            INSERT INTO agent_previews (id, thread_id, status, user_visible_summary, payload_json)
            VALUES (?1, ?2, 'active', ?3, ?4)
            ON CONFLICT(id) DO UPDATE SET
              thread_id = excluded.thread_id,
              status = 'active',
              user_visible_summary = excluded.user_visible_summary,
              payload_json = excluded.payload_json
            "#,
            params![
                preview.id,
                thread_id,
                preview.user_visible_summary,
                payload_json
            ],
        )?;
        Ok(())
    }

    pub fn active_agent_preview(
        &self,
        preview_id: &str,
    ) -> Result<Option<AgentPreview>, RepositoryError> {
        let result = self.conn.query_row(
            r#"
            SELECT user_visible_summary, payload_json
            FROM agent_previews
            WHERE id = ?1 AND status = 'active'
            "#,
            params![preview_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        );

        match result {
            Ok((summary, payload_json)) => {
                if payload_json.trim().is_empty() {
                    decode_legacy_preview_payload(preview_id, &summary).map(Some)
                } else {
                    let mut preview =
                        serde_json::from_str::<AgentPreview>(&payload_json).map_err(|_| {
                            RepositoryError::InvalidPreviewPayload(preview_id.to_string())
                        })?;
                    preview.user_visible_summary = summary;
                    Ok(Some(preview))
                }
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(RepositoryError::Sqlite(error)),
        }
    }

    pub fn set_agent_preview_status(
        &self,
        preview_id: &str,
        status: &str,
    ) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            UPDATE agent_previews
            SET status = ?2
            WHERE id = ?1
            "#,
            params![preview_id, status],
        )?;
        Ok(())
    }

    pub fn insert_check_in(&self, check_in: &CheckIn) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO check_ins (id, workspace_id, node_id, body)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(id) DO UPDATE SET
              workspace_id = excluded.workspace_id,
              node_id = excluded.node_id,
              body = excluded.body
            "#,
            params![
                check_in.id,
                check_in.workspace_id,
                check_in.node_id,
                check_in.body,
            ],
        )?;
        Ok(())
    }

    pub fn check_ins(&self, workspace_id: &str) -> Result<Vec<CheckIn>, RepositoryError> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, workspace_id, node_id, body
            FROM check_ins
            WHERE workspace_id = ?1
            ORDER BY created_at, id
            "#,
        )?;
        let rows = stmt.query_map(params![workspace_id], |row| {
            Ok(CheckIn {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                node_id: row.get(2)?,
                body: row.get(3)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(RepositoryError::from)
    }

    pub fn upsert_setting(&self, key: &str, value: &str) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO settings (key, value)
            VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = CURRENT_TIMESTAMP
            "#,
            params![key, value],
        )?;
        Ok(())
    }

    pub fn setting(&self, key: &str) -> Result<Option<String>, RepositoryError> {
        let result = self.conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(RepositoryError::Sqlite(error)),
        }
    }

    fn upsert_node_metadata(
        &self,
        node_id: &str,
        metadata: &NodeExecutionMetadata,
    ) -> Result<(), RepositoryError> {
        self.conn.execute(
            r#"
            INSERT INTO node_execution_metadata (
              node_id,
              energy_level,
              friction_level,
              estimated_minutes,
              minimum_done,
              context_tags,
              last_started_at,
              last_checked_in_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(node_id) DO UPDATE SET
              energy_level = excluded.energy_level,
              friction_level = excluded.friction_level,
              estimated_minutes = excluded.estimated_minutes,
              minimum_done = excluded.minimum_done,
              context_tags = excluded.context_tags,
              last_started_at = excluded.last_started_at,
              last_checked_in_at = excluded.last_checked_in_at,
              updated_at = CURRENT_TIMESTAMP
            "#,
            params![
                node_id,
                metadata.energy_level,
                metadata.friction_level,
                metadata.estimated_minutes,
                metadata.minimum_done,
                join_tags(&metadata.context_tags),
                metadata.last_started_at,
                metadata.last_checked_in_at,
            ],
        )?;
        Ok(())
    }
}

fn attention_session_from_row(
    row: AttentionSessionRow,
) -> Result<AttentionSession, RepositoryError> {
    let state = AttentionSessionState::from_str(&row.state)
        .ok_or_else(|| RepositoryError::InvalidAttentionSessionState(row.state.clone()))?;
    Ok(AttentionSession {
        id: row.id,
        start_plan_id: row.start_plan_id,
        next_action_id: row.next_action_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        intended_duration_minutes: row.intended_duration_minutes,
        state,
        completion_note: row.completion_note,
    })
}

fn node_row_from_sql(row: &rusqlite::Row<'_>) -> rusqlite::Result<NodeRow> {
    let kind_text: String = row.get(2)?;
    let position_x = row.get::<_, Option<f64>>(5)?;
    let position_y = row.get::<_, Option<f64>>(6)?;
    let metadata = if row.get::<_, Option<i64>>(7)?.is_some()
        || row.get::<_, Option<i64>>(8)?.is_some()
        || row.get::<_, Option<i64>>(9)?.is_some()
        || row.get::<_, Option<String>>(10)?.is_some()
        || row.get::<_, Option<String>>(11)?.is_some()
        || row.get::<_, Option<String>>(12)?.is_some()
        || row.get::<_, Option<String>>(13)?.is_some()
    {
        Some(NodeExecutionMetadata {
            energy_level: row.get::<_, Option<i64>>(7)?.map(|value| value as u8),
            friction_level: row.get::<_, Option<i64>>(8)?.map(|value| value as u8),
            estimated_minutes: row.get::<_, Option<i64>>(9)?.map(|value| value as u16),
            minimum_done: row.get(10)?,
            context_tags: split_tags(row.get::<_, Option<String>>(11)?.unwrap_or_default()),
            last_started_at: row.get(12)?,
            last_checked_in_at: row.get(13)?,
        })
    } else {
        None
    };
    Ok(NodeRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        kind: kind_text,
        title: row.get(3)?,
        body: row.get(4)?,
        metadata,
        position: position_x
            .zip(position_y)
            .map(|(x, y)| NodePosition { x, y }),
    })
}

fn graph_node_from_row(row: NodeRow) -> Result<GraphNode, RepositoryError> {
    let kind = NodeKind::from_str(&row.kind)
        .ok_or_else(|| RepositoryError::InvalidNodeKind(row.kind.clone()))?;
    Ok(GraphNode {
        id: row.id,
        workspace_id: row.workspace_id,
        kind,
        title: row.title,
        body: row.body,
        metadata: row.metadata,
        position: row.position,
    })
}

struct EdgeRow {
    id: String,
    workspace_id: String,
    source_id: String,
    target_id: String,
    kind: String,
}

struct NodeRow {
    id: String,
    workspace_id: String,
    kind: String,
    title: String,
    body: Option<String>,
    metadata: Option<NodeExecutionMetadata>,
    position: Option<NodePosition>,
}

struct ExperimentRow {
    id: String,
    support_template_id: Option<String>,
    custom_support_title: Option<String>,
    context: String,
    helped_start: bool,
    helped_continue: bool,
    helped_return: bool,
    helped_clarify_next_action: bool,
    obstacle_note: Option<String>,
    next_decision: String,
}

struct ContextProfileRow {
    id: String,
    workspace_id: String,
    adult_contexts: String,
    execution_difficulties: String,
    preferred_support_categories: String,
    llm_provider_setup_state: String,
}

struct AttentionSessionRow {
    id: String,
    start_plan_id: Option<String>,
    next_action_id: String,
    started_at: String,
    ended_at: Option<String>,
    intended_duration_minutes: Option<u16>,
    state: String,
    completion_note: Option<String>,
}

struct AiProposalRow {
    id: String,
    proposal_type: String,
    status: String,
}

fn join_tags(tags: &[String]) -> String {
    tags.join("\n")
}

fn join_support_categories(categories: &[SupportCategory]) -> String {
    categories
        .iter()
        .map(|category| category.as_str())
        .collect::<Vec<_>>()
        .join("\n")
}

fn split_tags(value: String) -> Vec<String> {
    value
        .lines()
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn decode_legacy_preview_payload(
    preview_id: &str,
    payload: &str,
) -> Result<AgentPreview, RepositoryError> {
    let sections = payload
        .split("\n---preview-section---\n")
        .collect::<Vec<_>>();
    if sections.len() != 3 && sections.len() != 6 {
        return Err(RepositoryError::InvalidPreviewPayload(
            preview_id.to_string(),
        ));
    }

    let proposed_nodes = if sections[1].trim().is_empty() {
        Vec::new()
    } else {
        sections[1]
            .lines()
            .map(|line| {
                let fields = line.split('\t').collect::<Vec<_>>();
                if fields.len() != 4 {
                    return Err(RepositoryError::InvalidPreviewPayload(
                        preview_id.to_string(),
                    ));
                }
                let kind = NodeKind::from_str(fields[1]).ok_or_else(|| {
                    RepositoryError::InvalidPreviewPayload(preview_id.to_string())
                })?;
                let body = unescape_preview_field(fields[3]);
                Ok(ProposedNode {
                    id: unescape_preview_field(fields[0]),
                    kind,
                    title: unescape_preview_field(fields[2]),
                    body: (!body.is_empty()).then_some(body),
                })
            })
            .collect::<Result<Vec<_>, RepositoryError>>()?
    };

    let proposed_edges = if sections[2].trim().is_empty() {
        Vec::new()
    } else {
        sections[2]
            .lines()
            .map(|line| {
                let fields = line.split('\t').collect::<Vec<_>>();
                if fields.len() != 4 {
                    return Err(RepositoryError::InvalidPreviewPayload(
                        preview_id.to_string(),
                    ));
                }
                let kind = EdgeKind::from_str(fields[3]).ok_or_else(|| {
                    RepositoryError::InvalidPreviewPayload(preview_id.to_string())
                })?;
                Ok(ProposedEdge {
                    id: unescape_preview_field(fields[0]),
                    source_id: unescape_preview_field(fields[1]),
                    target_id: unescape_preview_field(fields[2]),
                    kind,
                })
            })
            .collect::<Result<Vec<_>, RepositoryError>>()?
    };
    let proposed_memory = if sections.len() < 4 || sections[3].trim().is_empty() {
        Vec::new()
    } else {
        sections[3]
            .lines()
            .map(|line| {
                let fields = line.split('\t').collect::<Vec<_>>();
                if fields.len() != 3 {
                    return Err(RepositoryError::InvalidPreviewPayload(
                        preview_id.to_string(),
                    ));
                }
                let evidence_reference = unescape_preview_field(fields[2]);
                Ok(MemoryProposal {
                    id: unescape_preview_field(fields[0]),
                    proposed_memory_text: unescape_preview_field(fields[1]),
                    evidence_reference: (!evidence_reference.is_empty())
                        .then_some(evidence_reference),
                })
            })
            .collect::<Result<Vec<_>, RepositoryError>>()?
    };
    let proposed_check_ins = if sections.len() < 5 || sections[4].trim().is_empty() {
        Vec::new()
    } else {
        sections[4]
            .lines()
            .map(|line| {
                let fields = line.split('\t').collect::<Vec<_>>();
                if fields.len() != 4 {
                    return Err(RepositoryError::InvalidPreviewPayload(
                        preview_id.to_string(),
                    ));
                }
                let node_id = unescape_preview_field(fields[2]);
                Ok(CheckIn {
                    id: unescape_preview_field(fields[0]),
                    workspace_id: unescape_preview_field(fields[1]),
                    node_id: (!node_id.is_empty()).then_some(node_id),
                    body: unescape_preview_field(fields[3]),
                })
            })
            .collect::<Result<Vec<_>, RepositoryError>>()?
    };
    let proposed_strategy_experiments = if sections.len() < 6 || sections[5].trim().is_empty() {
        Vec::new()
    } else {
        sections[5]
            .lines()
            .map(|line| {
                let fields = line.split('\t').collect::<Vec<_>>();
                if fields.len() != 10 {
                    return Err(RepositoryError::InvalidPreviewPayload(
                        preview_id.to_string(),
                    ));
                }
                let support_template_id = unescape_preview_field(fields[1]);
                let custom_support_title = unescape_preview_field(fields[2]);
                let context = ExperimentContext::from_str(fields[3]).ok_or_else(|| {
                    RepositoryError::InvalidPreviewPayload(preview_id.to_string())
                })?;
                let helped_start = decode_preview_bool(preview_id, fields[4])?;
                let helped_continue = decode_preview_bool(preview_id, fields[5])?;
                let helped_return = decode_preview_bool(preview_id, fields[6])?;
                let helped_clarify_next_action = decode_preview_bool(preview_id, fields[7])?;
                let obstacle_note = unescape_preview_field(fields[8]);
                let next_decision = StrategyDecision::from_str(fields[9]).ok_or_else(|| {
                    RepositoryError::InvalidPreviewPayload(preview_id.to_string())
                })?;

                Ok(StrategyExperiment {
                    id: unescape_preview_field(fields[0]),
                    support_template_id: (!support_template_id.is_empty())
                        .then_some(support_template_id),
                    custom_support_title: (!custom_support_title.is_empty())
                        .then_some(custom_support_title),
                    context,
                    helped_start,
                    helped_continue,
                    helped_return,
                    helped_clarify_next_action,
                    obstacle_note: (!obstacle_note.is_empty()).then_some(obstacle_note),
                    next_decision,
                })
            })
            .collect::<Result<Vec<_>, RepositoryError>>()?
    };

    Ok(AgentPreview {
        id: preview_id.to_string(),
        proposed_nodes,
        proposed_edges,
        proposed_memory,
        proposed_check_ins,
        proposed_strategy_experiments,
        user_visible_summary: unescape_preview_field(sections[0]),
    })
}

fn decode_preview_bool(preview_id: &str, value: &str) -> Result<bool, RepositoryError> {
    match value {
        "true" => Ok(true),
        "false" => Ok(false),
        _ => Err(RepositoryError::InvalidPreviewPayload(
            preview_id.to_string(),
        )),
    }
}

fn unescape_preview_field(value: &str) -> String {
    let mut output = String::new();
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }

        match chars.next() {
            Some('t') => output.push('\t'),
            Some('n') => output.push('\n'),
            Some('\\') => output.push('\\'),
            Some(other) => {
                output.push('\\');
                output.push(other);
            }
            None => output.push('\\'),
        }
    }
    output
}
