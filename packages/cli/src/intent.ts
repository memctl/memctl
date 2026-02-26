export const SEARCH_INTENTS = [
  "entity",
  "aspect",
  "temporal",
  "exploratory",
  "relationship",
] as const;

export type SearchIntent = (typeof SEARCH_INTENTS)[number];

export interface IntentClassification {
  intent: SearchIntent;
  confidence: number;
  extractedTerms: string[];
  suggestedTypes?: string[];
}

export interface IntentWeights {
  ftsBoost: number;
  vectorBoost: number;
  recencyBoost: number;
  priorityBoost: number;
  graphBoost: number;
}

const INTENT_WEIGHTS: Record<SearchIntent, IntentWeights> = {
  entity: {
    ftsBoost: 2.0,
    vectorBoost: 0.5,
    recencyBoost: 0.3,
    priorityBoost: 1.0,
    graphBoost: 0,
  },
  temporal: {
    ftsBoost: 0.7,
    vectorBoost: 0.5,
    recencyBoost: 3.0,
    priorityBoost: 0.5,
    graphBoost: 0,
  },
  relationship: {
    ftsBoost: 0.5,
    vectorBoost: 1.5,
    recencyBoost: 1.0,
    priorityBoost: 1.0,
    graphBoost: 2.0,
  },
  aspect: {
    ftsBoost: 1.0,
    vectorBoost: 1.5,
    recencyBoost: 0.5,
    priorityBoost: 1.5,
    graphBoost: 0,
  },
  exploratory: {
    ftsBoost: 1.0,
    vectorBoost: 1.2,
    recencyBoost: 1.0,
    priorityBoost: 1.0,
    graphBoost: 0,
  },
};

const TEMPORAL_PATTERNS =
  /\b(recent(ly)?|latest|last\s+week|changed|new(ly)?|updated|since|yesterday|today)\b/i;

const RELATIONSHIP_PATTERNS =
  /\b(related\s+to|depends\s+on|connected|linked|references|impacts|affects)\b/i;

const ASPECT_PATTERNS =
  /\b(conventions?|rules?|patterns?|how\s+to|best\s+practice|style|strategy)\b/i;

const ASPECT_TYPE_NAMES = new Set([
  "testing",
  "architecture",
  "coding_style",
  "constraints",
  "lessons_learned",
  "file_map",
  "folder_structure",
  "workflows",
  "dependencies",
  "deployment",
  "security",
]);

const FILE_EXT_PATTERN = /\.\w{1,6}$/;
const IDENTIFIER_PATTERN = /^[A-Z][a-zA-Z0-9]+$|^[a-z]+(_[a-z]+)+$/;
const PATH_PATTERN = /\//;
const QUESTION_WORDS = /^(what|how|why|where|when|which|who|show|tell)\b/i;

function extractTerms(query: string): string[] {
  return query
    .replace(/[^a-zA-Z0-9/_.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function suggestTypesFromQuery(query: string): string[] | undefined {
  const lower = query.toLowerCase();
  const matched: string[] = [];
  for (const name of ASPECT_TYPE_NAMES) {
    if (lower.includes(name.replace(/_/g, " ")) || lower.includes(name)) {
      matched.push(name);
    }
  }
  return matched.length > 0 ? matched : undefined;
}

export function classifySearchIntent(query: string): IntentClassification {
  const trimmed = query.trim();
  const terms = extractTerms(trimmed);
  const words = trimmed.split(/\s+/);

  if (PATH_PATTERN.test(trimmed)) {
    return {
      intent: "entity",
      confidence: 0.9,
      extractedTerms: terms,
    };
  }
  if (words.length === 1 && IDENTIFIER_PATTERN.test(words[0]!)) {
    return {
      intent: "entity",
      confidence: 0.85,
      extractedTerms: terms,
    };
  }
  if (FILE_EXT_PATTERN.test(trimmed)) {
    return {
      intent: "entity",
      confidence: 0.8,
      extractedTerms: terms,
    };
  }
  if (
    words.length <= 3 &&
    !QUESTION_WORDS.test(trimmed) &&
    !TEMPORAL_PATTERNS.test(trimmed) &&
    !RELATIONSHIP_PATTERNS.test(trimmed) &&
    !ASPECT_PATTERNS.test(trimmed)
  ) {
    return {
      intent: "entity",
      confidence: 0.6,
      extractedTerms: terms,
    };
  }

  if (TEMPORAL_PATTERNS.test(trimmed)) {
    return {
      intent: "temporal",
      confidence: 0.85,
      extractedTerms: terms,
    };
  }

  if (RELATIONSHIP_PATTERNS.test(trimmed)) {
    return {
      intent: "relationship",
      confidence: 0.8,
      extractedTerms: terms,
    };
  }

  const suggestedTypes = suggestTypesFromQuery(trimmed);
  if (ASPECT_PATTERNS.test(trimmed) || suggestedTypes) {
    return {
      intent: "aspect",
      confidence: 0.75,
      extractedTerms: terms,
      suggestedTypes,
    };
  }

  return {
    intent: "exploratory",
    confidence: 0.5,
    extractedTerms: terms,
    suggestedTypes: suggestTypesFromQuery(trimmed),
  };
}

export function getIntentWeights(intent: SearchIntent): IntentWeights {
  return INTENT_WEIGHTS[intent];
}
