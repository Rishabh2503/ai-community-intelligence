/**
 * Pure vector helpers used by semantic search, recommendations, matching and RAG.
 * Keeping the maths in one module means every AI feature shares exactly the
 * same similarity semantics (DRY) and can be unit-tested in isolation.
 */
export const VectorMath = {
  dot(a: readonly number[], b: readonly number[]): number {
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += a[i] * b[i];
    return sum;
  },

  magnitude(vector: readonly number[]): number {
    let sum = 0;
    for (const value of vector) sum += value * value;
    return Math.sqrt(sum);
  },

  cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    const magA = VectorMath.magnitude(a);
    const magB = VectorMath.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return VectorMath.dot(a, b) / (magA * magB);
  },

  normalize(vector: readonly number[]): number[] {
    const mag = VectorMath.magnitude(vector);
    if (mag === 0) return [...vector];
    return vector.map((value) => value / mag);
  },

  /** Average of several vectors - used to build a "taste profile" from history. */
  centroid(vectors: readonly (readonly number[])[]): number[] {
    if (vectors.length === 0) return [];
    const dim = vectors[0].length;
    const acc = new Array<number>(dim).fill(0);
    for (const vector of vectors) {
      for (let i = 0; i < dim; i += 1) acc[i] += vector[i] ?? 0;
    }
    return acc.map((value) => value / vectors.length);
  },
};

/** Maps a cosine score in [-1, 1] to an easy-to-display percentage in [0, 100]. */
export const toMatchPercentage = (score: number): number =>
  Math.round(Math.max(0, Math.min(1, (score + 1) / 2)) * 100);
