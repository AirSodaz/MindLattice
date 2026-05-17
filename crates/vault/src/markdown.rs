use std::collections::{HashMap, HashSet};

use mindlattice_core::domain::{
    EdgeKind, GraphEdge, GraphNode, NodeExecutionMetadata, NodeKind, Workspace,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultExportFile {
    pub filename: String,
    pub content: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultExportResult {
    pub files: Vec<VaultExportFile>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultImportFile {
    pub filename: String,
    pub content: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct VaultImportResult {
    pub nodes_created: usize,
    pub edges_created: usize,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub fn export_workspace(
    _workspace: &Workspace,
    nodes: &[GraphNode],
    edges: &[GraphEdge],
) -> VaultExportResult {
    let titles_by_id = nodes
        .iter()
        .map(|node| (node.id.as_str(), node.title.as_str()))
        .collect::<HashMap<_, _>>();
    let files = nodes
        .iter()
        .map(|node| VaultExportFile {
            filename: format!("{}.md", sanitize_filename(&node.title)),
            content: export_node(node, edges, &titles_by_id),
        })
        .collect();
    VaultExportResult { files }
}

pub fn import_files(workspace_id: &str, files: &[VaultImportFile]) -> VaultImportResult {
    let parsed = resolve_import_conflicts(files.iter().map(parse_file).collect::<Vec<_>>());
    let title_to_id = parsed
        .iter()
        .map(|file| (file.title.clone(), file.node.id.clone()))
        .collect::<HashMap<_, _>>();
    let mut edges = Vec::new();

    for file in &parsed {
        for link in &file.wiki_links {
            if let Some(target_id) = title_to_id.get(link) {
                edges.push(import_edge(
                    workspace_id,
                    &file.node.id,
                    target_id,
                    EdgeKind::Related,
                ));
            }
        }

        for relationship in &file.relationships {
            if let Some(target_id) = title_to_id.get(&relationship.target_title) {
                edges.push(import_edge(
                    workspace_id,
                    &file.node.id,
                    target_id,
                    relationship.kind,
                ));
            }
        }
    }

    let nodes = parsed
        .into_iter()
        .map(|file| GraphNode {
            workspace_id: workspace_id.to_string(),
            ..file.node
        })
        .collect::<Vec<_>>();

    VaultImportResult {
        nodes_created: nodes.len(),
        edges_created: edges.len(),
        nodes,
        edges,
    }
}

fn resolve_import_conflicts(files: Vec<ParsedImportFile>) -> Vec<ParsedImportFile> {
    let mut used_titles = HashSet::<String>::new();
    let mut used_ids = HashSet::<String>::new();

    files
        .into_iter()
        .map(|mut file| {
            file.title = claim_unique_value(&mut used_titles, &file.title, " ");
            file.node.title = file.title.clone();
            file.node.id = claim_unique_value(&mut used_ids, &file.node.id, "-");

            file
        })
        .collect()
}

fn claim_unique_value(used_values: &mut HashSet<String>, value: &str, separator: &str) -> String {
    if used_values.insert(value.to_string()) {
        return value.to_string();
    }

    let mut suffix = 2;
    loop {
        let candidate = format!("{value}{separator}{suffix}");
        if used_values.insert(candidate.clone()) {
            return candidate;
        }
        suffix += 1;
    }
}

fn import_edge(workspace_id: &str, source_id: &str, target_id: &str, kind: EdgeKind) -> GraphEdge {
    GraphEdge {
        id: format!(
            "vault-edge-{}-{}-{}",
            slugify_id(source_id),
            slugify_id(target_id),
            kind.as_str()
        ),
        workspace_id: workspace_id.to_string(),
        source_id: source_id.to_string(),
        target_id: target_id.to_string(),
        kind,
    }
}

fn export_node(
    node: &GraphNode,
    edges: &[GraphEdge],
    titles_by_id: &HashMap<&str, &str>,
) -> String {
    let mut output = String::new();
    output.push_str("---\n");
    output.push_str(&format!("mindlattice_id: {}\n", node.id));
    output.push_str(&format!("kind: {}\n", node.kind.as_str()));
    if let Some(metadata) = &node.metadata {
        if let Some(energy_level) = metadata.energy_level {
            output.push_str(&format!("energy_level: {energy_level}\n"));
        }
        if let Some(friction_level) = metadata.friction_level {
            output.push_str(&format!("friction_level: {friction_level}\n"));
        }
        if let Some(estimated_minutes) = metadata.estimated_minutes {
            output.push_str(&format!("estimated_minutes: {estimated_minutes}\n"));
        }
        if let Some(minimum_done) = &metadata.minimum_done {
            output.push_str(&format!("minimum_done: {}\n", yaml_scalar(minimum_done)));
        }
        if !metadata.context_tags.is_empty() {
            output.push_str(&format!(
                "context_tags: {}\n",
                metadata.context_tags.join(", ")
            ));
        }
    }
    output.push_str("---\n\n");
    output.push_str(&format!("# {}\n", node.title));
    if let Some(body) = &node.body {
        if !body.trim().is_empty() {
            output.push('\n');
            output.push_str(body.trim());
            output.push('\n');
        }
    }

    let relationship_lines = edges
        .iter()
        .filter(|edge| edge.source_id == node.id)
        .filter_map(|edge| {
            let target_title = titles_by_id.get(edge.target_id.as_str())?;
            Some(format!("- {}: [[{}]]", edge.kind.as_str(), target_title))
        })
        .collect::<Vec<_>>();

    if !relationship_lines.is_empty() {
        output.push_str("\n## Relationships\n\n");
        output.push_str(&relationship_lines.join("\n"));
        output.push('\n');
    }

    output
}

fn parse_file(file: &VaultImportFile) -> ParsedImportFile {
    let (frontmatter, markdown) = split_frontmatter(&file.content);
    let title = frontmatter
        .get("title")
        .cloned()
        .or_else(|| first_heading(markdown))
        .unwrap_or_else(|| filename_stem(&file.filename));
    let id = frontmatter
        .get("mindlattice_id")
        .cloned()
        .unwrap_or_else(|| format!("vault-node-{}", slugify_id(&title)));
    let kind = frontmatter
        .get("kind")
        .and_then(|value| NodeKind::from_str(value))
        .unwrap_or(NodeKind::Note);
    let metadata = metadata_from_frontmatter(&frontmatter);
    let relationships = extract_relationships(markdown);
    let markdown_without_relationships = strip_relationships_section(markdown);
    let body = body_without_first_heading(&markdown_without_relationships);
    let wiki_links = extract_wiki_links(&markdown_without_relationships);

    ParsedImportFile {
        title: title.clone(),
        wiki_links,
        relationships,
        node: GraphNode {
            id,
            workspace_id: String::new(),
            kind,
            title,
            body: if body.trim().is_empty() {
                None
            } else {
                Some(body.trim().to_string())
            },
            metadata,
            position: None,
        },
    }
}

fn split_frontmatter(content: &str) -> (HashMap<String, String>, &str) {
    let Some(rest) = content
        .strip_prefix("---\n")
        .or_else(|| content.strip_prefix("---\r\n"))
    else {
        return (HashMap::new(), content);
    };
    let Some(end_index) = rest.find("\n---").or_else(|| rest.find("\r\n---")) else {
        return (HashMap::new(), content);
    };
    let frontmatter_text = &rest[..end_index];
    let markdown = rest[end_index..]
        .trim_start_matches(['\r', '\n'])
        .strip_prefix("---")
        .unwrap_or_default()
        .trim_start_matches(['\r', '\n']);
    (parse_frontmatter(frontmatter_text), markdown)
}

fn parse_frontmatter(frontmatter: &str) -> HashMap<String, String> {
    let mut parsed = HashMap::new();
    let mut active_list_key: Option<String> = None;
    let mut active_flow_list: Option<FlowList> = None;
    let mut active_block_scalar: Option<BlockScalar> = None;

    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if let Some(flow_list) = active_flow_list.as_mut() {
            let flow_line = strip_yaml_inline_comment(trimmed);
            flow_list.lines.push(flow_line.clone());
            if flow_line.ends_with(']') {
                let finished = active_flow_list.take().expect("flow list exists");
                parsed.insert(finished.key, yaml_value(&finished.lines.join(" ")));
            }
            continue;
        }

        if let Some(block_scalar) = active_block_scalar.as_mut() {
            if trimmed.is_empty() {
                block_scalar.lines.push(String::new());
                continue;
            }
            if let Some(item) = strip_yaml_block_indent(line, block_scalar.indent) {
                block_scalar.lines.push(item.trim_end().to_string());
                continue;
            }
            let finished = active_block_scalar.take().expect("block scalar exists");
            parsed.insert(
                finished.key,
                yaml_block_scalar_value(&finished.lines, finished.separator),
            );
        }

        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some(key) = &active_list_key {
            if let Some(item) = trimmed.strip_prefix("- ") {
                parsed
                    .entry(key.clone())
                    .and_modify(|value: &mut String| {
                        if !value.is_empty() {
                            value.push('\n');
                        }
                        value.push_str(&yaml_unquote(&strip_yaml_inline_comment(item)));
                    })
                    .or_insert_with(|| yaml_unquote(&strip_yaml_inline_comment(item)));
                continue;
            }
            active_list_key = None;
        }

        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        let key = key.trim().to_string();
        let value = strip_yaml_inline_comment(value.trim());
        if value.is_empty() {
            active_list_key = Some(key.clone());
            parsed.entry(key).or_insert_with(String::new);
            continue;
        }
        if starts_multiline_flow_list(&value) {
            active_flow_list = Some(FlowList {
                key: key.clone(),
                lines: vec![value],
            });
            continue;
        }
        if let Some(separator) = block_scalar_separator(&value) {
            active_block_scalar = Some(BlockScalar {
                key: key.clone(),
                separator: separator.separator,
                indent: separator.indent,
                lines: Vec::new(),
            });
            continue;
        }

        parsed.insert(key, yaml_value(&value));
    }

    if let Some(finished) = active_block_scalar.take() {
        parsed.insert(
            finished.key,
            yaml_block_scalar_value(&finished.lines, finished.separator),
        );
    }
    if let Some(finished) = active_flow_list.take() {
        parsed.insert(finished.key, yaml_value(&finished.lines.join(" ")));
    }

    parsed
}

struct BlockScalar {
    key: String,
    separator: char,
    indent: usize,
    lines: Vec<String>,
}

struct BlockScalarHeader {
    separator: char,
    indent: usize,
}

struct FlowList {
    key: String,
    lines: Vec<String>,
}

fn starts_multiline_flow_list(value: &str) -> bool {
    value.starts_with('[') && !value.ends_with(']')
}

fn block_scalar_separator(value: &str) -> Option<BlockScalarHeader> {
    let indicator = value.chars().next()?;
    if indicator != '|' && indicator != '>' {
        return None;
    }
    let modifiers = &value[indicator.len_utf8()..];
    let mut indent_digits = String::new();
    for character in modifiers.chars() {
        if character.is_ascii_digit() {
            indent_digits.push(character);
            continue;
        }
        if !matches!(character, '-' | '+') {
            return None;
        }
    }
    let indent = if indent_digits.is_empty() {
        2
    } else {
        indent_digits.parse::<usize>().ok()?
    };
    Some(BlockScalarHeader {
        separator: if indicator == '>' { ' ' } else { '\n' },
        indent,
    })
}

fn strip_yaml_block_indent(line: &str, indent: usize) -> Option<&str> {
    let mut byte_index = 0;
    let mut spaces = 0;
    for character in line.chars() {
        if character == ' ' && spaces < indent {
            spaces += 1;
            byte_index += character.len_utf8();
            continue;
        }
        break;
    }
    if spaces >= indent {
        Some(&line[byte_index..])
    } else {
        None
    }
}

fn yaml_block_scalar_value(lines: &[String], separator: char) -> String {
    let common_indent = lines
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            line.chars()
                .take_while(|character| *character == ' ')
                .count()
        })
        .min()
        .unwrap_or(0);
    let normalized = lines
        .iter()
        .map(|line| strip_leading_spaces(line, common_indent).to_string())
        .collect::<Vec<_>>();

    if separator == '\n' {
        return normalized.join("\n").trim_end().to_string();
    }

    let mut output = String::new();
    let mut previous_blank = false;
    for line in normalized {
        if line.is_empty() {
            if !output.is_empty() && !output.ends_with('\n') {
                output.push('\n');
            }
            previous_blank = true;
            continue;
        }
        if !output.is_empty() && !previous_blank && !output.ends_with('\n') {
            output.push(' ');
        }
        output.push_str(&line);
        previous_blank = false;
    }
    output.trim_end().to_string()
}

fn strip_leading_spaces(value: &str, spaces: usize) -> &str {
    let mut byte_index = 0;
    let mut stripped = 0;
    for character in value.chars() {
        if character == ' ' && stripped < spaces {
            stripped += 1;
            byte_index += character.len_utf8();
            continue;
        }
        break;
    }
    &value[byte_index..]
}

fn first_heading(markdown: &str) -> Option<String> {
    markdown.lines().find_map(|line| {
        line.strip_prefix("# ")
            .map(str::trim)
            .filter(|title| !title.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn body_without_first_heading(markdown: &str) -> String {
    let mut skipped_heading = false;
    markdown
        .lines()
        .filter(|line| {
            if !skipped_heading && line.starts_with("# ") {
                skipped_heading = true;
                false
            } else {
                true
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn metadata_from_frontmatter(
    frontmatter: &HashMap<String, String>,
) -> Option<NodeExecutionMetadata> {
    let metadata = NodeExecutionMetadata {
        energy_level: frontmatter
            .get("energy_level")
            .and_then(|value| value.parse::<u8>().ok()),
        friction_level: frontmatter
            .get("friction_level")
            .and_then(|value| value.parse::<u8>().ok()),
        estimated_minutes: frontmatter
            .get("estimated_minutes")
            .and_then(|value| value.parse::<u16>().ok()),
        minimum_done: frontmatter.get("minimum_done").cloned(),
        context_tags: frontmatter
            .get("context_tags")
            .or_else(|| frontmatter.get("tags"))
            .map(|value| {
                yaml_list_items(value)
                    .into_iter()
                    .map(str::trim)
                    .filter(|tag| !tag.is_empty())
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default(),
        last_started_at: None,
        last_checked_in_at: None,
    };

    if metadata.energy_level.is_some()
        || metadata.friction_level.is_some()
        || metadata.estimated_minutes.is_some()
        || metadata.minimum_done.is_some()
        || !metadata.context_tags.is_empty()
    {
        Some(metadata)
    } else {
        None
    }
}

fn yaml_value(value: &str) -> String {
    let trimmed = strip_yaml_inline_comment(value);
    if let Some(inner) = trimmed
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
    {
        return split_yaml_inline_list(inner)
            .into_iter()
            .map(|item| yaml_unquote(&item))
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
    }

    yaml_unquote(&trimmed)
}

fn yaml_list_items(value: &str) -> Vec<&str> {
    if value.contains('\n') {
        value.lines().collect()
    } else {
        value.split(',').collect()
    }
}

fn strip_yaml_inline_comment(value: &str) -> String {
    let mut quote: Option<char> = None;
    let mut previous: Option<char> = None;
    let mut output = String::new();

    for character in value.trim().chars() {
        match character {
            '\'' | '"' if quote == Some(character) => quote = None,
            '\'' | '"' if quote.is_none() => quote = Some(character),
            '#' if quote.is_none()
                && previous
                    .map(|previous| previous.is_whitespace())
                    .unwrap_or(true) =>
            {
                break;
            }
            _ => {}
        }
        output.push(character);
        previous = Some(character);
    }

    output.trim().to_string()
}

fn split_yaml_inline_list(value: &str) -> Vec<String> {
    let mut items = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;

    for character in value.chars() {
        match character {
            '\'' | '"' if quote == Some(character) => quote = None,
            '\'' | '"' if quote.is_none() => quote = Some(character),
            ',' if quote.is_none() => {
                items.push(current.trim().to_string());
                current.clear();
                continue;
            }
            _ => {}
        }
        current.push(character);
    }

    if !current.trim().is_empty() {
        items.push(current.trim().to_string());
    }

    items
}

fn yaml_unquote(value: &str) -> String {
    let trimmed = value.trim();
    if let Some(inner) = quoted_inner(trimmed, '"') {
        return unescape_yaml_double_quoted(inner);
    }
    if let Some(inner) = quoted_inner(trimmed, '\'') {
        return inner.replace("''", "'");
    }
    trimmed.to_string()
}

fn quoted_inner(value: &str, quote: char) -> Option<&str> {
    value
        .strip_prefix(quote)
        .and_then(|value| value.strip_suffix(quote))
}

fn unescape_yaml_double_quoted(value: &str) -> String {
    let mut output = String::new();
    let mut characters = value.chars();

    while let Some(character) = characters.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }

        match characters.next() {
            Some('"') => output.push('"'),
            Some('\\') => output.push('\\'),
            Some('n') => output.push('\n'),
            Some('r') => output.push('\r'),
            Some('t') => output.push('\t'),
            Some(other) => {
                output.push('\\');
                output.push(other);
            }
            None => output.push('\\'),
        }
    }

    output
}

fn extract_wiki_links(markdown: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut rest = markdown;
    while let Some(start) = rest.find("[[") {
        let after_start = &rest[start + 2..];
        let Some(end) = after_start.find("]]") else {
            break;
        };
        let link = after_start[..end]
            .split('|')
            .next()
            .unwrap_or_default()
            .trim();
        if !link.is_empty() {
            links.push(link.to_string());
        }
        rest = &after_start[end + 2..];
    }
    links
}

fn extract_relationships(markdown: &str) -> Vec<ParsedRelationship> {
    relationship_section(markdown)
        .lines()
        .filter_map(parse_relationship_line)
        .collect()
}

fn relationship_section(markdown: &str) -> &str {
    let Some(start) = section_heading_start(markdown, "## Relationships") else {
        return "";
    };
    let section = &markdown[start..].trim_start_matches(['\r', '\n']);
    let Some((_, after_heading)) = section.split_once('\n') else {
        return "";
    };
    let end = section_heading_start(after_heading, "## ").unwrap_or(after_heading.len());
    &after_heading[..end]
}

fn strip_relationships_section(markdown: &str) -> String {
    let Some(start) = section_heading_start(markdown, "## Relationships") else {
        return markdown.to_string();
    };
    let before = &markdown[..start];
    let section = &markdown[start..].trim_start_matches(['\r', '\n']);
    let Some((heading, after_heading)) = section.split_once('\n') else {
        return before.trim_end().to_string();
    };
    if heading.trim() != "## Relationships" {
        return markdown.to_string();
    }
    let after_end = after_heading
        .find("\n## ")
        .or_else(|| after_heading.find("\r\n## "))
        .map(|index| &after_heading[index..])
        .unwrap_or("");
    format!("{}{}", before.trim_end(), after_end)
}

fn section_heading_start(markdown: &str, heading: &str) -> Option<usize> {
    if markdown.starts_with(heading) && heading_line_matches(markdown, 0, heading) {
        return Some(0);
    }
    find_heading_start(markdown, &format!("\n{heading}"), heading)
        .or_else(|| find_heading_start(markdown, &format!("\r\n{heading}"), heading))
}

fn find_heading_start(markdown: &str, pattern: &str, heading: &str) -> Option<usize> {
    let mut search_start = 0;
    while let Some(relative_start) = markdown[search_start..].find(pattern) {
        let start = search_start + relative_start;
        let heading_start = start + pattern.len() - heading.len();
        if heading_line_matches(markdown, heading_start, heading) {
            return Some(start);
        }
        search_start = heading_start + heading.len();
    }
    None
}

fn heading_line_matches(markdown: &str, heading_start: usize, heading: &str) -> bool {
    let after_heading = &markdown[heading_start + heading.len()..];
    after_heading
        .chars()
        .next()
        .is_none_or(|character| character == '\r' || character == '\n')
}

fn parse_relationship_line(line: &str) -> Option<ParsedRelationship> {
    let trimmed = line.trim();
    let relationship = trimmed.strip_prefix("- ")?.trim();
    let (kind, target) = relationship.split_once(':')?;
    let kind = EdgeKind::from_str(kind.trim())?;
    let target_title = extract_wiki_links(target).into_iter().next()?;
    Some(ParsedRelationship { kind, target_title })
}

fn filename_stem(filename: &str) -> String {
    filename
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(filename)
        .replace(['_', '-'], " ")
        .trim()
        .to_string()
}

fn sanitize_filename(title: &str) -> String {
    let sanitized = title
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            other => other,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    if sanitized.is_empty() {
        "Untitled".to_string()
    } else {
        sanitized
    }
}

fn slugify_id(value: &str) -> String {
    let slug = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        "untitled".to_string()
    } else {
        slug
    }
}

fn yaml_scalar(value: &str) -> String {
    value.replace('\n', " ").trim().to_string()
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ParsedRelationship {
    kind: EdgeKind,
    target_title: String,
}

struct ParsedImportFile {
    title: String,
    wiki_links: Vec<String>,
    relationships: Vec<ParsedRelationship>,
    node: GraphNode,
}
