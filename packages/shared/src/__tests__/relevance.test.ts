import { describe, it, expect } from "vitest";
import {
  computeRelevanceScore,
  getRelevanceBucket,
  computeRelevanceDistribution,
} from "../relevance";
import type { RelevanceInput } from "../relevance";

// Fixed timestamp: 2025-01-15T00:00:00.000Z
const NOW = 1736899200000;
const ONE_DAY_MS = 86_400_000;

function makeInput(overrides: Partial<RelevanceInput> = {}): RelevanceInput {
  return {
    priority: 10,
    accessCount: 1,
    lastAccessedAt: NOW - ONE_DAY_MS, // accessed 1 day ago
    helpfulCount: 0,
    unhelpfulCount: 0,
    pinnedAt: null,
    ...overrides,
  };
}

describe("computeRelevanceScore", () => {
  describe("basic scoring", () => {
    it("produces a positive score with default inputs", () => {
      const score = computeRelevanceScore(makeInput(), NOW);
      expect(score).toBeGreaterThan(0);
    });

    it("returns a finite number", () => {
      const score = computeRelevanceScore(makeInput(), NOW);
      expect(Number.isFinite(score)).toBe(true);
    });
  });

  describe("priority impact", () => {
    it("higher priority produces a higher score", () => {
      const lowPriority = computeRelevanceScore(
        makeInput({ priority: 10 }),
        NOW,
      );
      const midPriority = computeRelevanceScore(
        makeInput({ priority: 50 }),
        NOW,
      );
      const highPriority = computeRelevanceScore(
        makeInput({ priority: 100 }),
        NOW,
      );

      expect(highPriority).toBeGreaterThan(midPriority);
      expect(midPriority).toBeGreaterThan(lowPriority);
    });

    it("priority of 0 uses minimum floor of 1", () => {
      const scoreZero = computeRelevanceScore(makeInput({ priority: 0 }), NOW);
      const scoreOne = computeRelevanceScore(makeInput({ priority: 1 }), NOW);

      // priority 0 is clamped to 1, so both should produce the same score
      expect(scoreZero).toBe(scoreOne);
    });

    it("score scales linearly with priority when other factors are constant", () => {
      // Use low accessCount=0 so scores stay below 100 cap
      const score5 = computeRelevanceScore(
        makeInput({ priority: 5, accessCount: 0 }),
        NOW,
      );
      const score10 = computeRelevanceScore(
        makeInput({ priority: 10, accessCount: 0 }),
        NOW,
      );
      const score20 = computeRelevanceScore(
        makeInput({ priority: 20, accessCount: 0 }),
        NOW,
      );

      // score10 / score5 should be approximately 2
      expect(score10 / score5).toBeCloseTo(2, 1);
      // score20 / score10 should be approximately 2
      expect(score20 / score10).toBeCloseTo(2, 1);
    });
  });

  describe("access count impact", () => {
    it("more accesses produce a higher score (logarithmic growth)", () => {
      const noAccess = computeRelevanceScore(
        makeInput({ accessCount: 0 }),
        NOW,
      );
      const fewAccesses = computeRelevanceScore(
        makeInput({ accessCount: 5 }),
        NOW,
      );
      const manyAccesses = computeRelevanceScore(
        makeInput({ accessCount: 100 }),
        NOW,
      );

      expect(manyAccesses).toBeGreaterThan(fewAccesses);
      expect(fewAccesses).toBeGreaterThan(noAccess);
    });

    it("has diminishing returns for higher access counts", () => {
      const score0to10 =
        computeRelevanceScore(makeInput({ accessCount: 10 }), NOW) -
        computeRelevanceScore(makeInput({ accessCount: 0 }), NOW);

      const score100to110 =
        computeRelevanceScore(makeInput({ accessCount: 110 }), NOW) -
        computeRelevanceScore(makeInput({ accessCount: 100 }), NOW);

      // The marginal gain from 0->10 should be much larger than 100->110
      expect(score0to10).toBeGreaterThan(score100to110);
    });

    it("zero accessCount still produces a positive score", () => {
      const score = computeRelevanceScore(makeInput({ accessCount: 0 }), NOW);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe("time decay", () => {
    it("memories not accessed for a long time have lower scores", () => {
      const recentAccess = computeRelevanceScore(
        makeInput({ lastAccessedAt: NOW - ONE_DAY_MS }),
        NOW,
      );
      const oldAccess = computeRelevanceScore(
        makeInput({ lastAccessedAt: NOW - 90 * ONE_DAY_MS }),
        NOW,
      );
      const veryOldAccess = computeRelevanceScore(
        makeInput({ lastAccessedAt: NOW - 365 * ONE_DAY_MS }),
        NOW,
      );

      expect(recentAccess).toBeGreaterThan(oldAccess);
      expect(oldAccess).toBeGreaterThan(veryOldAccess);
    });

    it("access just now yields timeFactor close to 1", () => {
      const justNow = computeRelevanceScore(
        makeInput({ lastAccessedAt: NOW }),
        NOW,
      );
      // With lastAccessedAt === NOW, timeFactor = exp(0) = 1, so score is
      // basePriority * usageFactor * 1 * 1 * 1 * 100
      const base = makeInput({ lastAccessedAt: NOW });
      const expected =
        (Math.max(base.priority, 1) / 100) *
        (1 + Math.log(1 + base.accessCount)) *
        100;
      expect(justNow).toBeCloseTo(expected, 1);
    });

    it("null lastAccessedAt means no time decay (timeFactor = 1)", () => {
      const nullAccess = computeRelevanceScore(
        makeInput({ lastAccessedAt: null }),
        NOW,
      );
      const justNow = computeRelevanceScore(
        makeInput({ lastAccessedAt: NOW }),
        NOW,
      );

      // Both should have timeFactor = 1
      expect(nullAccess).toBe(justNow);
    });

    it("lastAccessedAt of 0 means no time decay (treated as falsy)", () => {
      // The code checks `lastAccessedAt !== null && lastAccessedAt > 0`
      const zeroAccess = computeRelevanceScore(
        makeInput({ lastAccessedAt: 0 }),
        NOW,
      );
      const nullAccess = computeRelevanceScore(
        makeInput({ lastAccessedAt: null }),
        NOW,
      );

      expect(zeroAccess).toBe(nullAccess);
    });

    it("future lastAccessedAt is clamped to 0 days (no negative decay)", () => {
      const futureAccess = computeRelevanceScore(
        makeInput({ lastAccessedAt: NOW + 10 * ONE_DAY_MS }),
        NOW,
      );
      const justNow = computeRelevanceScore(
        makeInput({ lastAccessedAt: NOW }),
        NOW,
      );

      // daysSinceAccess uses Math.max(0, ...) so future access is the same as now
      expect(futureAccess).toBe(justNow);
    });
  });

  describe("half-life verification", () => {
    it("~23 days halves the time factor (decay rate 0.03)", () => {
      const halfLifeDays = 23;
      const recentInput = makeInput({ lastAccessedAt: NOW });
      const halfLifeInput = makeInput({
        lastAccessedAt: NOW - halfLifeDays * ONE_DAY_MS,
      });

      const recentScore = computeRelevanceScore(recentInput, NOW);
      const halfLifeScore = computeRelevanceScore(halfLifeInput, NOW);

      // exp(-0.03 * 23) ≈ 0.5016, so the score at 23 days should be ~50% of the recent score
      const ratio = halfLifeScore / recentScore;
      expect(ratio).toBeCloseTo(0.5, 1);
    });

    it("exact half-life calculation: exp(-0.03 * 23) is approximately 0.50", () => {
      const decayFactor = Math.exp(-0.03 * 23);
      expect(decayFactor).toBeCloseTo(0.5, 1);
    });

    it("double half-life (~46 days) yields ~25% of the time factor", () => {
      const recentInput = makeInput({ lastAccessedAt: NOW });
      const doubleHalfLifeInput = makeInput({
        lastAccessedAt: NOW - 46 * ONE_DAY_MS,
      });

      const recentScore = computeRelevanceScore(recentInput, NOW);
      const decayedScore = computeRelevanceScore(doubleHalfLifeInput, NOW);

      const ratio = decayedScore / recentScore;
      expect(ratio).toBeCloseTo(0.25, 1);
    });
  });

  describe("feedback impact", () => {
    it("helpful feedback boosts the score", () => {
      const noFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 0 }),
        NOW,
      );
      const helpfulFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 10, unhelpfulCount: 0 }),
        NOW,
      );

      expect(helpfulFeedback).toBeGreaterThan(noFeedback);
    });

    it("unhelpful feedback reduces the score", () => {
      const noFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 0 }),
        NOW,
      );
      const unhelpfulFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 10 }),
        NOW,
      );

      expect(unhelpfulFeedback).toBeLessThan(noFeedback);
    });

    it("all helpful feedback gives feedbackFactor of 1.5", () => {
      const allHelpful = computeRelevanceScore(
        makeInput({ helpfulCount: 10, unhelpfulCount: 0 }),
        NOW,
      );
      const noFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 0 }),
        NOW,
      );

      // feedbackFactor for all helpful: 0.5 + (10/10) = 1.5
      // feedbackFactor for no feedback: 1.0
      expect(allHelpful / noFeedback).toBeCloseTo(1.5, 2);
    });

    it("all unhelpful feedback gives feedbackFactor of 0.5", () => {
      const allUnhelpful = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 10 }),
        NOW,
      );
      const noFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 0 }),
        NOW,
      );

      // feedbackFactor for all unhelpful: 0.5 + (0/10) = 0.5
      expect(allUnhelpful / noFeedback).toBeCloseTo(0.5, 2);
    });

    it("equal helpful and unhelpful gives feedbackFactor of 1.0", () => {
      const equalFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 5, unhelpfulCount: 5 }),
        NOW,
      );
      const noFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 0 }),
        NOW,
      );

      // feedbackFactor: 0.5 + (5/10) = 1.0
      expect(equalFeedback).toBe(noFeedback);
    });
  });

  describe("pin boost", () => {
    it("pinned memories get 1.5x boost", () => {
      // Use low values to avoid hitting the 100 cap
      const lowInput = {
        priority: 5,
        accessCount: 0,
        lastAccessedAt: NOW - ONE_DAY_MS,
        helpfulCount: 0,
        unhelpfulCount: 0,
      };
      const unpinned = computeRelevanceScore(
        { ...lowInput, pinnedAt: null },
        NOW,
      );
      const pinned = computeRelevanceScore(
        { ...lowInput, pinnedAt: NOW - ONE_DAY_MS },
        NOW,
      );

      expect(pinned / unpinned).toBeCloseTo(1.5, 2);
    });

    it("pin boost stacks with other factors", () => {
      // Use low values so scores don't cap at 100
      const lowInput = {
        priority: 5,
        accessCount: 0,
        lastAccessedAt: NOW - ONE_DAY_MS,
        unhelpfulCount: 0,
      };
      const base = computeRelevanceScore(
        { ...lowInput, helpfulCount: 3, pinnedAt: null },
        NOW,
      );
      const pinnedWithFeedback = computeRelevanceScore(
        { ...lowInput, helpfulCount: 3, pinnedAt: NOW },
        NOW,
      );

      expect(pinnedWithFeedback / base).toBeCloseTo(1.5, 2);
    });
  });

  describe("max score capping", () => {
    it("score should never exceed 100", () => {
      // Use the most extreme inputs to try to push beyond 100
      const score = computeRelevanceScore(
        {
          priority: 100,
          accessCount: 1_000_000,
          lastAccessedAt: NOW,
          helpfulCount: 1000,
          unhelpfulCount: 0,
          pinnedAt: NOW,
        },
        NOW,
      );

      expect(score).toBeLessThanOrEqual(100);
    });

    it("high priority + many accesses + helpful + pinned caps at 100", () => {
      const score = computeRelevanceScore(
        {
          priority: 100,
          accessCount: 10000,
          lastAccessedAt: NOW,
          helpfulCount: 100,
          unhelpfulCount: 0,
          pinnedAt: NOW,
        },
        NOW,
      );

      expect(score).toBe(100);
    });
  });

  describe("minimum floor", () => {
    it("score should never be negative", () => {
      const score = computeRelevanceScore(
        {
          priority: 0,
          accessCount: 0,
          lastAccessedAt: NOW - 365 * 10 * ONE_DAY_MS, // 10 years ago
          helpfulCount: 0,
          unhelpfulCount: 1000,
          pinnedAt: null,
        },
        NOW,
      );

      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("extremely decayed memory with all unhelpful feedback stays non-negative", () => {
      const score = computeRelevanceScore(
        {
          priority: 1,
          accessCount: 0,
          lastAccessedAt: NOW - 1000 * ONE_DAY_MS,
          helpfulCount: 0,
          unhelpfulCount: 100,
          pinnedAt: null,
        },
        NOW,
      );

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("edge cases", () => {
    it("zero accessCount still produces a score based on priority", () => {
      const score = computeRelevanceScore(
        makeInput({ accessCount: 0, lastAccessedAt: null }),
        NOW,
      );

      // usageFactor = 1 + log(1 + 0) = 1 + 0 = 1
      // basePriority = 10/100 = 0.1
      // timeFactor = 1 (null lastAccessedAt)
      // feedbackFactor = 1
      // pinBoost = 1
      // raw = 0.1 * 1 * 1 * 1 * 1 * 100 = 10
      expect(score).toBe(10);
    });

    it("null lastAccessedAt with zero accessCount", () => {
      const score = computeRelevanceScore(
        {
          priority: 100,
          accessCount: 0,
          lastAccessedAt: null,
          helpfulCount: 0,
          unhelpfulCount: 0,
          pinnedAt: null,
        },
        NOW,
      );

      // basePriority = 1.0, usageFactor = 1, timeFactor = 1, feedbackFactor = 1, pinBoost = 1
      // raw = 1.0 * 1 * 1 * 1 * 1 * 100 = 100
      expect(score).toBe(100);
    });

    it("equal helpful and unhelpful counts result in feedbackFactor of 1.0", () => {
      const equalFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 50, unhelpfulCount: 50 }),
        NOW,
      );
      const noFeedback = computeRelevanceScore(
        makeInput({ helpfulCount: 0, unhelpfulCount: 0 }),
        NOW,
      );

      expect(equalFeedback).toBe(noFeedback);
    });

    it("now parameter defaults to Date.now when not provided", () => {
      const input = makeInput({ lastAccessedAt: null });
      const withNow = computeRelevanceScore(input, Date.now());
      const withoutNow = computeRelevanceScore(input);

      // Since lastAccessedAt is null, timeFactor is always 1 regardless of now
      expect(withNow).toBe(withoutNow);
    });

    it("score is rounded to two decimal places", () => {
      const score = computeRelevanceScore(
        makeInput({ priority: 33, accessCount: 7 }),
        NOW,
      );
      const decimalPlaces = (score.toString().split(".")[1] || "").length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });
});

describe("getRelevanceBucket", () => {
  it("returns 'excellent' for score >= 60", () => {
    expect(getRelevanceBucket(60)).toBe("excellent");
    expect(getRelevanceBucket(75)).toBe("excellent");
    expect(getRelevanceBucket(100)).toBe("excellent");
  });

  it("returns 'good' for score >= 30 and < 60", () => {
    expect(getRelevanceBucket(30)).toBe("good");
    expect(getRelevanceBucket(45)).toBe("good");
    expect(getRelevanceBucket(59)).toBe("good");
    expect(getRelevanceBucket(59.99)).toBe("good");
  });

  it("returns 'fair' for score >= 10 and < 30", () => {
    expect(getRelevanceBucket(10)).toBe("fair");
    expect(getRelevanceBucket(20)).toBe("fair");
    expect(getRelevanceBucket(29)).toBe("fair");
    expect(getRelevanceBucket(29.99)).toBe("fair");
  });

  it("returns 'poor' for score < 10", () => {
    expect(getRelevanceBucket(0)).toBe("poor");
    expect(getRelevanceBucket(5)).toBe("poor");
    expect(getRelevanceBucket(9)).toBe("poor");
    expect(getRelevanceBucket(9.99)).toBe("poor");
  });

  it("handles exact boundary values correctly", () => {
    expect(getRelevanceBucket(10)).toBe("fair");
    expect(getRelevanceBucket(30)).toBe("good");
    expect(getRelevanceBucket(60)).toBe("excellent");
  });

  it("handles negative scores", () => {
    expect(getRelevanceBucket(-1)).toBe("poor");
    expect(getRelevanceBucket(-100)).toBe("poor");
  });
});

describe("computeRelevanceDistribution", () => {
  it("returns correct distribution for mixed scores", () => {
    const scores = [80, 70, 65, 45, 35, 20, 15, 5, 3];
    const dist = computeRelevanceDistribution(scores);

    expect(dist).toEqual({
      excellent: 3, // 80, 70, 65
      good: 2, // 45, 35
      fair: 2, // 20, 15
      poor: 2, // 5, 3
    });
  });

  it("returns all zeros for empty scores array", () => {
    const dist = computeRelevanceDistribution([]);

    expect(dist).toEqual({
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
    });
  });

  it("handles all scores in the same bucket", () => {
    const dist = computeRelevanceDistribution([90, 80, 70, 60]);

    expect(dist).toEqual({
      excellent: 4,
      good: 0,
      fair: 0,
      poor: 0,
    });
  });

  it("handles boundary values correctly", () => {
    const dist = computeRelevanceDistribution([60, 30, 10, 9]);

    expect(dist).toEqual({
      excellent: 1,
      good: 1,
      fair: 1,
      poor: 1,
    });
  });

  it("handles single score", () => {
    const dist = computeRelevanceDistribution([50]);

    expect(dist).toEqual({
      excellent: 0,
      good: 1,
      fair: 0,
      poor: 0,
    });
  });

  it("handles duplicate scores", () => {
    const dist = computeRelevanceDistribution([50, 50, 50]);

    expect(dist).toEqual({
      excellent: 0,
      good: 3,
      fair: 0,
      poor: 0,
    });
  });

  it("total count equals input length", () => {
    const scores = [100, 80, 60, 40, 20, 10, 5, 0];
    const dist = computeRelevanceDistribution(scores);
    const total = dist.excellent + dist.good + dist.fair + dist.poor;

    expect(total).toBe(scores.length);
  });
});
