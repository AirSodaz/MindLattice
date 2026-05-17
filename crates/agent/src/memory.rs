use std::collections::HashSet;

pub fn retrieve_relevant_preferences(
    user_message: &str,
    confirmed_memory: &[String],
    limit: usize,
) -> Vec<String> {
    if limit == 0 {
        return Vec::new();
    }

    let query_terms = normalized_terms(user_message);
    let mut scored = confirmed_memory
        .iter()
        .enumerate()
        .filter_map(|(index, memory)| {
            let terms = normalized_terms(memory);
            let score = terms.intersection(&query_terms).count();
            (score > 0).then_some((score, index, memory.clone()))
        })
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));
    scored
        .into_iter()
        .take(limit)
        .map(|(_, _, memory)| memory)
        .collect()
}

fn normalized_terms(text: &str) -> HashSet<String> {
    text.split(|character: char| !character.is_alphanumeric())
        .filter_map(normalize_term)
        .collect()
}

fn normalize_term(term: &str) -> Option<String> {
    let normalized = term.trim().to_lowercase();
    if normalized.len() < 4 {
        return None;
    }
    Some(match normalized.as_str() {
        "reopening" | "returning" | "returned" => "return".to_string(),
        "interruptions" | "interrupted" => "interruption".to_string(),
        "drafts" => "draft".to_string(),
        _ => normalized,
    })
}
