use mindlattice_core::domain::{
    EdgeKind, GraphEdge, GraphNode, MapSnapshot, NodeExecutionMetadata, NodeKind, Workspace,
};
use mindlattice_vault::markdown::{export_workspace, import_files, VaultImportFile};

fn workspace() -> Workspace {
    Workspace {
        id: "workspace-1".to_string(),
        title: "Writing".to_string(),
    }
}

fn task_node() -> GraphNode {
    GraphNode {
        id: "task-1".to_string(),
        workspace_id: workspace().id,
        kind: NodeKind::Task,
        title: "Plan launch".to_string(),
        body: Some("Outline the launch notes.\n\nLink to [[Find examples]].".to_string()),
        metadata: Some(NodeExecutionMetadata {
            energy_level: Some(2),
            friction_level: Some(3),
            estimated_minutes: Some(20),
            minimum_done: Some("Three rough bullets exist.".to_string()),
            context_tags: vec!["work".to_string(), "writing".to_string()],
            last_started_at: None,
            last_checked_in_at: None,
        }),
        position: None,
    }
}

fn next_action_node() -> GraphNode {
    GraphNode {
        id: "next-1".to_string(),
        workspace_id: workspace().id,
        kind: NodeKind::NextAction,
        title: "Find examples".to_string(),
        body: None,
        metadata: None,
        position: None,
    }
}

#[test]
fn exports_one_readable_markdown_file_per_node_with_frontmatter() {
    let nodes = vec![task_node(), next_action_node()];
    let edges = vec![GraphEdge {
        id: "edge-1".to_string(),
        workspace_id: workspace().id,
        source_id: "task-1".to_string(),
        target_id: "next-1".to_string(),
        kind: EdgeKind::BreaksDownTo,
    }];

    let exported = export_workspace(&workspace(), &nodes, &edges);

    assert_eq!(exported.files.len(), 2);
    assert_eq!(exported.files[0].filename, "Plan launch.md");
    assert!(exported.files[0].content.contains("mindlattice_id: task-1"));
    assert!(exported.files[0].content.contains("kind: task"));
    assert!(exported.files[0].content.contains("estimated_minutes: 20"));
    assert!(exported.files[0]
        .content
        .contains("minimum_done: Three rough bullets exist."));
    assert!(exported.files[0].content.contains("# Plan launch"));
    assert!(exported.files[0]
        .content
        .contains("Link to [[Find examples]]."));
    assert!(exported.files[0]
        .content
        .contains("- breaks_down_to: [[Find examples]]"));
}

#[test]
fn imports_markdown_files_and_resolves_wiki_links_as_related_edges() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "Plan launch.md".to_string(),
                content: "---\nmindlattice_id: task-1\nkind: task\n---\n# Plan launch\nUse [[Find examples]] before writing.".to_string(),
            },
            VaultImportFile {
                filename: "Find examples.md".to_string(),
                content: "# Find examples\nCollect one source.".to_string(),
            },
        ],
    );

    assert_eq!(imported.nodes_created, 2);
    assert_eq!(imported.edges_created, 1);
    assert_eq!(imported.nodes[0].id, "task-1");
    assert_eq!(imported.nodes[0].kind, NodeKind::Task);
    assert_eq!(imported.nodes[0].title, "Plan launch");
    assert_eq!(
        imported.nodes[0].body.as_deref(),
        Some("Use [[Find examples]] before writing.")
    );
    assert_eq!(imported.nodes[1].kind, NodeKind::Note);
    assert_eq!(imported.edges[0].kind, EdgeKind::Related);
    assert_eq!(imported.edges[0].source_id, "task-1");
    assert_eq!(imported.edges[0].target_id, imported.nodes[1].id);
}

#[test]
fn imports_common_yaml_frontmatter_edge_cases() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "ignored-filename.md".to_string(),
                content: r#"---
title: "Launch: rough notes"
mindlattice_id: quoted-title
kind: next_action
minimum_done: "Three rough bullets: no polish"
context_tags: [work, "writing sprint"]
---
# Heading should not override title
Start with [[Reference Note]].
"#
                .to_string(),
            },
            VaultImportFile {
                filename: "Reference Note.md".to_string(),
                content: r#"---
kind: resource
context_tags:
  - research
  - launch notes
---
# Reference Note
One link.
"#
                .to_string(),
            },
        ],
    );

    assert_eq!(imported.nodes_created, 2);
    assert_eq!(imported.edges_created, 1);
    assert_eq!(imported.nodes[0].id, "quoted-title");
    assert_eq!(imported.nodes[0].title, "Launch: rough notes");
    assert_eq!(imported.nodes[0].kind, NodeKind::NextAction);
    assert_eq!(
        imported.nodes[0]
            .metadata
            .as_ref()
            .unwrap()
            .minimum_done
            .as_deref(),
        Some("Three rough bullets: no polish")
    );
    assert_eq!(
        imported.nodes[0].metadata.as_ref().unwrap().context_tags,
        vec!["work".to_string(), "writing sprint".to_string()]
    );
    assert_eq!(imported.nodes[1].kind, NodeKind::Resource);
    assert_eq!(
        imported.nodes[1].metadata.as_ref().unwrap().context_tags,
        vec!["research".to_string(), "launch notes".to_string()]
    );
}

#[test]
fn imports_yaml_frontmatter_with_inline_comments() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Commented.md".to_string(),
            content: r#"---
title: Launch notes # imported from Obsidian
minimum_done: "Keep # hash in the quoted value" # local note
context_tags: [work, "hash # kept", writing] # tag explanation
---
# Heading ignored
Body.
"#
            .to_string(),
        }],
    );

    assert_eq!(imported.nodes[0].title, "Launch notes");
    let metadata = imported.nodes[0].metadata.as_ref().unwrap();
    assert_eq!(
        metadata.minimum_done.as_deref(),
        Some("Keep # hash in the quoted value")
    );
    assert_eq!(
        metadata.context_tags,
        vec![
            "work".to_string(),
            "hash # kept".to_string(),
            "writing".to_string()
        ]
    );
}

#[test]
fn imports_yaml_block_list_tags_with_inline_comments_and_quotes() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Block tags.md".to_string(),
            content: r#"---
context_tags:
  - work # plain comment
  - "hash # kept" # comment after quoted hash
  - "writing, sprint" # comma stays in tag
---
# Block tags
Body.
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0].metadata.as_ref().unwrap().context_tags,
        vec![
            "work".to_string(),
            "hash # kept".to_string(),
            "writing, sprint".to_string()
        ]
    );
}

#[test]
fn imports_yaml_inline_list_tags_with_quoted_commas() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Inline tags.md".to_string(),
            content: r#"---
context_tags: [work, "writing, sprint", admin]
---
# Inline tags
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0].metadata.as_ref().unwrap().context_tags,
        vec![
            "work".to_string(),
            "writing, sprint".to_string(),
            "admin".to_string()
        ]
    );
}

#[test]
fn imports_yaml_multiline_flow_list_tags() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Multiline flow tags.md".to_string(),
            content: r#"---
context_tags: [
  work,
  "writing, sprint",
  admin # comment after item
]
---
# Multiline flow tags
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0].metadata.as_ref().unwrap().context_tags,
        vec![
            "work".to_string(),
            "writing, sprint".to_string(),
            "admin".to_string()
        ]
    );
}

#[test]
fn imports_yaml_literal_block_scalar_metadata() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Block scalar.md".to_string(),
            content: r#"---
minimum_done: |
  Open the notes.
  Write one rough bullet.
---
# Block scalar
Body.
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0]
            .metadata
            .as_ref()
            .unwrap()
            .minimum_done
            .as_deref(),
        Some("Open the notes.\nWrite one rough bullet.")
    );
}

#[test]
fn imports_yaml_folded_block_scalar_metadata() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Folded scalar.md".to_string(),
            content: r#"---
minimum_done: >
  Open the notes.
  Write one rough bullet.
---
# Folded scalar
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0]
            .metadata
            .as_ref()
            .unwrap()
            .minimum_done
            .as_deref(),
        Some("Open the notes. Write one rough bullet.")
    );
}

#[test]
fn imports_yaml_block_scalar_headers_with_inline_comments() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Block scalar header comment.md".to_string(),
            content: r#"---
minimum_done: >- # Obsidian keeps an explanatory note here
  Reopen the draft.
  Write one sentence.
---
# Block scalar header comment
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0]
            .metadata
            .as_ref()
            .unwrap()
            .minimum_done
            .as_deref(),
        Some("Reopen the draft. Write one sentence.")
    );
}

#[test]
fn imports_yaml_block_scalars_with_chomping_indicators() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "Literal chomp.md".to_string(),
                content: r#"---
minimum_done: |-
  Open the notes.
  Write one rough bullet.
---
# Literal chomp
"#
                .to_string(),
            },
            VaultImportFile {
                filename: "Folded chomp.md".to_string(),
                content: r#"---
minimum_done: >-
  Reopen the draft.
  Write one sentence.
---
# Folded chomp
"#
                .to_string(),
            },
        ],
    );

    assert_eq!(
        imported.nodes[0]
            .metadata
            .as_ref()
            .unwrap()
            .minimum_done
            .as_deref(),
        Some("Open the notes.\nWrite one rough bullet.")
    );
    assert_eq!(
        imported.nodes[1]
            .metadata
            .as_ref()
            .unwrap()
            .minimum_done
            .as_deref(),
        Some("Reopen the draft. Write one sentence.")
    );
}

#[test]
fn imports_yaml_block_scalars_with_indent_indicators_and_blank_lines() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Indented scalar.md".to_string(),
            content: r#"---
minimum_done: |2-
    Open the notes.

    Write one rough bullet.
---
# Indented scalar
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0]
            .metadata
            .as_ref()
            .unwrap()
            .minimum_done
            .as_deref(),
        Some("Open the notes.\n\nWrite one rough bullet.")
    );
}

#[test]
fn imports_yaml_double_quoted_escape_sequences() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Escaped.md".to_string(),
            content: r#"---
title: "Launch \"alpha\""
minimum_done: "Line one\nLine two"
context_tags: ["quote \"kept\"", "path C:\\notes"]
---
# Escaped
"#
            .to_string(),
        }],
    );

    assert_eq!(imported.nodes[0].title, "Launch \"alpha\"");
    let metadata = imported.nodes[0].metadata.as_ref().unwrap();
    assert_eq!(metadata.minimum_done.as_deref(), Some("Line one\nLine two"));
    assert_eq!(
        metadata.context_tags,
        vec!["quote \"kept\"".to_string(), "path C:\\notes".to_string()]
    );
}

#[test]
fn imports_obsidian_tags_alias_as_context_tags() {
    let imported = import_files(
        "workspace-1",
        &[VaultImportFile {
            filename: "Tagged.md".to_string(),
            content: r#"---
tags:
  - work
  - "writing, sprint"
---
# Tagged
Body.
"#
            .to_string(),
        }],
    );

    assert_eq!(
        imported.nodes[0].metadata.as_ref().unwrap().context_tags,
        vec!["work".to_string(), "writing, sprint".to_string()]
    );
}

#[test]
fn imports_crlf_markdown_frontmatter_links_and_relationships() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "Plan launch.md".to_string(),
                content: concat!(
                    "---\r\n",
                    "mindlattice_id: task-1\r\n",
                    "kind: task\r\n",
                    "context_tags:\r\n",
                    "  - windows\r\n",
                    "---\r\n",
                    "# Plan launch\r\n",
                    "Use [[Reference note]] before writing.\r\n",
                    "\r\n",
                    "## Relationships\r\n",
                    "\r\n",
                    "- blocked_by: [[Missing examples]]\r\n"
                )
                .to_string(),
            },
            VaultImportFile {
                filename: "Reference note.md".to_string(),
                content: "# Reference note\r\nCollect one source.".to_string(),
            },
            VaultImportFile {
                filename: "Missing examples.md".to_string(),
                content: "---\r\nmindlattice_id: blocker-1\r\nkind: blocker\r\n---\r\n# Missing examples\r\n".to_string(),
            },
        ],
    );

    assert_eq!(imported.nodes_created, 3);
    assert_eq!(imported.nodes[0].id, "task-1");
    assert_eq!(imported.nodes[0].kind, NodeKind::Task);
    assert_eq!(
        imported.nodes[0].metadata.as_ref().unwrap().context_tags,
        vec!["windows".to_string()]
    );
    assert_eq!(
        imported.nodes[0].body.as_deref(),
        Some("Use [[Reference note]] before writing.")
    );
    assert_eq!(imported.edges_created, 2);
    assert!(imported.edges.iter().any(|edge| edge.source_id == "task-1"
        && edge.target_id == imported.nodes[1].id
        && edge.kind == EdgeKind::Related));
    assert!(imported.edges.iter().any(|edge| edge.source_id == "task-1"
        && edge.target_id == "blocker-1"
        && edge.kind == EdgeKind::BlockedBy));
}

#[test]
fn relationship_section_detection_requires_exact_heading() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "Plan.md".to_string(),
                content: "# Plan\n\n## Relationships Archive\n\n- related: [[Reference]]\n\nKeep this note text.".to_string(),
            },
            VaultImportFile {
                filename: "Reference.md".to_string(),
                content: "# Reference\nTarget note.".to_string(),
            },
        ],
    );

    assert_eq!(
        imported.nodes[0].body.as_deref(),
        Some("## Relationships Archive\n\n- related: [[Reference]]\n\nKeep this note text.")
    );
    assert_eq!(imported.edges_created, 1);
    assert_eq!(imported.edges[0].kind, EdgeKind::Related);
}

#[test]
fn imports_exported_relationship_summaries_as_typed_edges() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "Plan launch.md".to_string(),
                content: r#"---
mindlattice_id: task-1
kind: task
---
# Plan launch

## Relationships

- breaks_down_to: [[Draft outline]]
- blocked_by: [[Missing examples]]
"#
                .to_string(),
            },
            VaultImportFile {
                filename: "Draft outline.md".to_string(),
                content: r#"---
mindlattice_id: next-1
kind: next_action
---
# Draft outline
"#
                .to_string(),
            },
            VaultImportFile {
                filename: "Missing examples.md".to_string(),
                content: r#"---
mindlattice_id: blocker-1
kind: blocker
---
# Missing examples
"#
                .to_string(),
            },
        ],
    );

    assert_eq!(imported.nodes_created, 3);
    assert_eq!(imported.edges_created, 2);
    assert_eq!(imported.nodes[0].body, None);
    assert!(imported.edges.iter().any(|edge| edge.source_id == "task-1"
        && edge.target_id == "next-1"
        && edge.kind == EdgeKind::BreaksDownTo));
    assert!(imported.edges.iter().any(|edge| edge.source_id == "task-1"
        && edge.target_id == "blocker-1"
        && edge.kind == EdgeKind::BlockedBy));
}

#[test]
fn imports_duplicate_title_files_with_deterministic_suffixes() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "Plan.md".to_string(),
                content: "# Plan\nFirst version links to [[Plan 2]].".to_string(),
            },
            VaultImportFile {
                filename: "Plan copy.md".to_string(),
                content: "---\ntitle: Plan\n---\nSecond version.".to_string(),
            },
        ],
    );

    assert_eq!(imported.nodes_created, 2);
    assert_eq!(imported.nodes[0].id, "vault-node-plan");
    assert_eq!(imported.nodes[0].title, "Plan");
    assert_eq!(imported.nodes[1].id, "vault-node-plan-2");
    assert_eq!(imported.nodes[1].title, "Plan 2");
    assert_eq!(imported.edges_created, 1);
    assert_eq!(imported.edges[0].source_id, "vault-node-plan");
    assert_eq!(imported.edges[0].target_id, "vault-node-plan-2");
}

#[test]
fn import_conflict_suffixes_do_not_collide_with_existing_titles_or_ids() {
    let imported = import_files(
        "workspace-1",
        &[
            VaultImportFile {
                filename: "Plan.md".to_string(),
                content: "# Plan\nOriginal.".to_string(),
            },
            VaultImportFile {
                filename: "Plan duplicate.md".to_string(),
                content: "# Plan\nDuplicate.".to_string(),
            },
            VaultImportFile {
                filename: "Plan 2.md".to_string(),
                content: r#"---
mindlattice_id: vault-node-plan-2
---
# Plan 2
Existing suffix.
"#
                .to_string(),
            },
        ],
    );

    let imported_titles = imported
        .nodes
        .iter()
        .map(|node| node.title.as_str())
        .collect::<Vec<_>>();
    let imported_ids = imported
        .nodes
        .iter()
        .map(|node| node.id.as_str())
        .collect::<Vec<_>>();

    assert_eq!(imported_titles, vec!["Plan", "Plan 2", "Plan 2 2"]);
    assert_eq!(
        imported_ids,
        vec![
            "vault-node-plan",
            "vault-node-plan-2",
            "vault-node-plan-2-2"
        ]
    );
}

#[test]
fn exported_markdown_can_be_imported_back_into_equivalent_nodes() {
    let snapshot = MapSnapshot {
        workspace: workspace(),
        nodes: vec![task_node(), next_action_node()],
        edges: vec![GraphEdge {
            id: "edge-1".to_string(),
            workspace_id: workspace().id,
            source_id: "task-1".to_string(),
            target_id: "next-1".to_string(),
            kind: EdgeKind::Related,
        }],
    };
    let exported = export_workspace(&snapshot.workspace, &snapshot.nodes, &snapshot.edges);
    let imported = import_files(
        &snapshot.workspace.id,
        &exported
            .files
            .iter()
            .map(|file| VaultImportFile {
                filename: file.filename.clone(),
                content: file.content.clone(),
            })
            .collect::<Vec<_>>(),
    );

    assert_eq!(imported.nodes.len(), 2);
    assert!(imported
        .nodes
        .iter()
        .any(|node| node.id == "task-1" && node.kind == NodeKind::Task));
    assert!(imported.edges.iter().any(|edge| edge.source_id == "task-1"
        && edge.target_id == "next-1"
        && edge.kind == EdgeKind::Related));
}
