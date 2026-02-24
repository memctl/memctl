/**
 * Compute a relevance score (0–100) for a memory based on usage signals.
 *
 * Formula:
 *   basePriority * (1 + log(1 + accessCount)) * exp(-0.03 * daysSinceAccess) * feedbackFactor * pinBoost
 *
 * Half-life: ~23 days (exp(-0.03 * 23) ≈ 0.50)
 */
export interface RelevanceInput {
  /** Base priority 0–100 */
  priority: number;
  /** Number of times this memory has been accessed */
  accessCount: number;
  /** Timestamp (ms) of last access, or null if never accessed */
  lastAccessedAt: number | null;
  /** Number of helpful feedback signals */
  helpfulCount: number;
  /** Number of unhelpful feedback signals */
  unhelpfulCount: number;
  /** Timestamp (ms) when pinned, or null if not pinned */
  pinnedAt: number | null;
}

const DECAY_RATE = 0.03; // per day
const PIN_BOOST = 1.5;
const MAX_SCORE = 100;

export function computeRelevanceScore(
  input: RelevanceInput,
  now?: number,
): number {
  const currentTime = now ?? Date.now();

  // Base priority normalized to 0–1 range, with a minimum floor
  const basePriority = Math.max(input.priority, 1) / 100;

  // Usage factor: log growth rewards repeated access but with diminishing returns
  const usageFactor = 1 + Math.log(1 + input.accessCount);

  // Time decay: exponential decay based on days since last access
  let timeFactor = 1;
  if (input.lastAccessedAt !== null && input.lastAccessedAt > 0) {
    const daysSinceAccess = Math.max(
      0,
      (currentTime - input.lastAccessedAt) / 86_400_000,
    );
    timeFactor = Math.exp(-DECAY_RATE * daysSinceAccess);
  }

  // Feedback factor: boost for helpful, penalty for unhelpful
  const totalFeedback = input.helpfulCount + input.unhelpfulCount;
  let feedbackFactor = 1;
  if (totalFeedback > 0) {
    const helpfulRatio = input.helpfulCount / totalFeedback;
    // Scale between 0.5 (all unhelpful) and 1.5 (all helpful)
    feedbackFactor = 0.5 + helpfulRatio;
  }

  // Pin boost
  const pinBoost = input.pinnedAt !== null ? PIN_BOOST : 1;

  const raw =
    basePriority *
    usageFactor *
    timeFactor *
    feedbackFactor *
    pinBoost *
    MAX_SCORE;
  return Math.min(MAX_SCORE, Math.max(0, Math.round(raw * 100) / 100));
}

export type RelevanceBucket = "excellent" | "good" | "fair" | "poor";

export function getRelevanceBucket(score: number): RelevanceBucket {
  if (score >= 60) return "excellent";
  if (score >= 30) return "good";
  if (score >= 10) return "fair";
  return "poor";
}

export function computeRelevanceDistribution(
  scores: number[],
): Record<RelevanceBucket, number> {
  const dist: Record<RelevanceBucket, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
  };
  for (const score of scores) {
    dist[getRelevanceBucket(score)]++;
  }
  return dist;
}
