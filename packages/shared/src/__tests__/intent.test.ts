import { describe, it, expect } from "vitest";
import {
  classifySearchIntent,
  getIntentWeights,
  SEARCH_INTENTS,
} from "../intent";
import type { SearchIntent } from "../intent";

describe("classifySearchIntent", () => {
  it("classifies path-like queries as entity", () => {
    const result = classifySearchIntent(
      "agent/context/architecture/api-design",
    );
    expect(result.intent).toBe("entity");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("classifies PascalCase identifiers as entity", () => {
    const result = classifySearchIntent("ApiClient");
    expect(result.intent).toBe("entity");
  });

  it("classifies snake_case identifiers as entity", () => {
    const result = classifySearchIntent("api_client");
    expect(result.intent).toBe("entity");
  });

  it("classifies file extension queries as entity", () => {
    const result = classifySearchIntent("config.ts");
    expect(result.intent).toBe("entity");
  });

  it("classifies short non-question queries as entity", () => {
    const result = classifySearchIntent("auth middleware");
    expect(result.intent).toBe("entity");
  });

  it("classifies 'recent decisions about auth' as temporal", () => {
    const result = classifySearchIntent("recent decisions about auth");
    expect(result.intent).toBe("temporal");
  });

  it("classifies 'what changed last week' as temporal", () => {
    const result = classifySearchIntent("what changed last week");
    expect(result.intent).toBe("temporal");
  });

  it("classifies 'latest updates' as temporal", () => {
    const result = classifySearchIntent("latest updates to billing");
    expect(result.intent).toBe("temporal");
  });

  it("classifies 'related to billing module' as relationship", () => {
    const result = classifySearchIntent("related to billing module");
    expect(result.intent).toBe("relationship");
  });

  it("classifies 'depends on auth service' as relationship", () => {
    const result = classifySearchIntent("depends on auth service");
    expect(result.intent).toBe("relationship");
  });

  it("classifies 'testing conventions for API routes' as aspect", () => {
    const result = classifySearchIntent("testing conventions for API routes");
    expect(result.intent).toBe("aspect");
  });

  it("classifies 'coding style rules' as aspect", () => {
    const result = classifySearchIntent("coding style rules");
    expect(result.intent).toBe("aspect");
  });

  it("classifies 'best practice for error handling' as aspect", () => {
    const result = classifySearchIntent("best practice for error handling");
    expect(result.intent).toBe("aspect");
  });

  it("classifies broad questions as exploratory", () => {
    const result = classifySearchIntent(
      "what do we know about authentication",
    );
    expect(result.intent).toBe("exploratory");
  });

  it("returns extractedTerms for all queries", () => {
    const result = classifySearchIntent("auth middleware setup");
    expect(result.extractedTerms.length).toBeGreaterThan(0);
  });

  it("returns suggestedTypes when type names appear in query", () => {
    const result = classifySearchIntent("testing conventions");
    expect(result.suggestedTypes).toContain("testing");
  });
});

describe("getIntentWeights", () => {
  it("entity has ftsBoost > 1", () => {
    const w = getIntentWeights("entity");
    expect(w.ftsBoost).toBeGreaterThan(1);
  });

  it("temporal has recencyBoost > 1", () => {
    const w = getIntentWeights("temporal");
    expect(w.recencyBoost).toBeGreaterThan(1);
  });

  it("relationship has graphBoost > 0", () => {
    const w = getIntentWeights("relationship");
    expect(w.graphBoost).toBeGreaterThan(0);
  });

  it("aspect has priorityBoost > 1", () => {
    const w = getIntentWeights("aspect");
    expect(w.priorityBoost).toBeGreaterThan(1);
  });

  it("returns valid weight objects for all intents", () => {
    for (const intent of SEARCH_INTENTS) {
      const w = getIntentWeights(intent as SearchIntent);
      expect(w).toHaveProperty("ftsBoost");
      expect(w).toHaveProperty("vectorBoost");
      expect(w).toHaveProperty("recencyBoost");
      expect(w).toHaveProperty("priorityBoost");
      expect(w).toHaveProperty("graphBoost");
      expect(typeof w.ftsBoost).toBe("number");
      expect(typeof w.vectorBoost).toBe("number");
      expect(typeof w.recencyBoost).toBe("number");
      expect(typeof w.priorityBoost).toBe("number");
      expect(typeof w.graphBoost).toBe("number");
    }
  });
});
