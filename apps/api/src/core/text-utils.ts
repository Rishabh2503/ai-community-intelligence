/**
 * Lightweight text utilities shared by the local AI provider, the keyword
 * re-ranker and the moderation heuristics.
 */

const STOP_WORDS = new Set([
  'a','about','above','after','again','all','also','am','an','and','any','are','as','at','be','because','been','before',
  'being','below','between','both','but','by','can','cannot','could','did','do','does','doing','down','during','each',
  'few','for','from','further','had','has','have','having','he','her','here','hers','him','his','how','i','if','in',
  'into','is','it','its','itself','just','me','more','most','my','no','nor','not','now','of','off','on','once','only',
  'or','other','our','ours','out','over','own','same','she','should','so','some','such','than','that','the','their',
  'them','then','there','these','they','this','those','through','to','too','under','until','up','very','was','we',
  'were','what','when','where','which','while','who','whom','why','will','with','would','you','your','yours',
]);

/** Generic verbs and nouns that phrase a question without being its subject. */
const QUESTION_FILLER = new Set([
  'know','tell','explain','explains','provide','provides','give','gives','need','needs','want','wants','find','finds',
  'looking','look','anyone','someone','somebody','help','helps','available','get','getting','use','using','make',
  'made','like','please','thing','things','stuff','info','information','details','detail','question','ask','asking',
  'recommend','recommends','suggest','suggests','way','ways','kind','sort','much','many','let','lets','able','going',
]);

export const TextUtils = {
  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/[\s\-_.]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  },

  /**
   * Tokens that actually carry the subject of a question.
   *
   * Plain `tokenize` keeps generic asking-words ("know", "explain", "provide"),
   * which unfairly dilute grounding checks: "What should I know about
   * accessibility audits?" is about *accessibility audits*, not about knowing.
   */
  contentTokens(text: string): string[] {
    return TextUtils.tokenize(text).filter((token) => !QUESTION_FILLER.has(token));
  },

  sentences(text: string): string[] {
    return text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  },

  truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  },

  /** Jaccard overlap of token sets - a cheap lexical similarity signal. */
  jaccard(a: string, b: string): number {
    const setA = new Set(TextUtils.tokenize(a));
    const setB = new Set(TextUtils.tokenize(b));
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const token of setA) if (setB.has(token)) intersection += 1;
    return intersection / (setA.size + setB.size - intersection);
  },

  /**
   * How much of `candidate`'s vocabulary already appears in `existing`.
   *
   * Unlike Jaccard this is asymmetric, which is exactly what near-duplicate
   * detection needs: indexed content is enriched with extra metadata and may
   * be split into chunks, so a genuine copy is *contained* in it without the
   * two texts being the same size.
   */
  containment(candidate: string, existing: string): number {
    const candidateTokens = new Set(TextUtils.tokenize(candidate));
    const existingTokens = new Set(TextUtils.tokenize(existing));
    if (candidateTokens.size === 0) return 0;
    let shared = 0;
    for (const token of candidateTokens) if (existingTokens.has(token)) shared += 1;
    return shared / candidateTokens.size;
  },

  /** Splits long documents into overlapping chunks for RAG indexing. */
  chunk(text: string, maxChars = 700, overlapChars = 120): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxChars) return clean ? [clean] : [];

    const sentences = TextUtils.sentences(clean);
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 <= maxChars) {
        current = current ? `${current} ${sentence}` : sentence;
        continue;
      }
      if (current) chunks.push(current);
      current = current.length > overlapChars ? `${current.slice(-overlapChars)} ${sentence}` : sentence;
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [clean.slice(0, maxChars)];
  },

  /** Highlights the most informative keywords of a text. */
  keywords(text: string, limit = 8): string[] {
    const counts = new Map<string, number>();
    for (const token of TextUtils.tokenize(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([token]) => token);
  },
};
