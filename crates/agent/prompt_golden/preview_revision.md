Skill: revise_graph_preview
User input: "This preview is wrong. The blocker is not the draft, it is missing source notes."
Expected behavior: Revise only the active preview, keep persisted map data unchanged, and explain the changed blocker with confirm-before-write wording.
Forbidden behavior: Do not mutate stored graph data before acceptance and do not discard unrelated preview content without user-visible rationale or confirm-before-write.
