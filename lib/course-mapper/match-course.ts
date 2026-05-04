import { COURSE_MAP, CourseEntry } from './course-map';

/**
 * Result of a course match attempt.
 * `null` means no high-confidence match was found.
 */
export interface CourseSuggestion {
  name: string;
  url: string;
  confidence: number;
}

/**
 * Normalize text for matching: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute a match score between a user query and a course entry.
 *
 * Scoring:
 *   - Exact keyword match in query → +course.confidence
 *   - Partial keyword match (keyword word appears in query) → +0.3 per word match
 *   - If multiple keywords match, take the best score (not cumulative)
 *
 * Returns the best match score (0–1 range), or 0 if no match.
 */
function matchScore(query: string, entry: CourseEntry): number {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) return 0;

  let bestScore = 0;

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalize(keyword);

    // Exact multi-word match (e.g., "dating profile" in query)
    if (normalizedQuery.includes(normalizedKeyword)) {
      // Weight longer keyword matches more — they're more specific
      const wordCount = normalizedKeyword.split(' ').length;
      const lengthBonus = Math.min(wordCount * 0.05, 0.15);
      const score = entry.confidence + lengthBonus;
      if (score > bestScore) bestScore = score;
      continue; // Don't also score partial matches for this keyword
    }

    // Partial match: check if individual words of the keyword appear
    const keywordWords = normalizedKeyword.split(' ').filter(w => w.length > 3); // Skip short words
    let matchedWords = 0;
    for (const word of keywordWords) {
      if (normalizedQuery.includes(word)) {
        matchedWords++;
      }
    }

    if (matchedWords > 0 && keywordWords.length > 0) {
      const partialScore = (matchedWords / keywordWords.length) * entry.confidence * 0.5;
      if (partialScore > bestScore) bestScore = partialScore;
    }
  }

  return bestScore;
}

/**
 * Find the best matching course for a user's query.
 *
 * Only returns a suggestion when match confidence exceeds the threshold
 * (default 0.6). Returns `null` if no confident match is found.
 *
 * @param query - The user's chat message or detected topic
 * @param minConfidence - Minimum score to return a suggestion (default 0.6)
 */
export function matchCourse(query: string, minConfidence = 0.6): CourseSuggestion | null {
  if (!query || !query.trim()) return null;

  const entries = Object.values(COURSE_MAP);
  let bestMatch: { entry: CourseEntry; score: number } | null = null;

  for (const entry of entries) {
    const score = matchScore(query, entry);
    if (score > (bestMatch?.score ?? 0)) {
      bestMatch = { entry, score };
    }
  }

  if (!bestMatch || bestMatch.score < minConfidence) {
    return null;
  }

  return {
    name: bestMatch.entry.name,
    url: bestMatch.entry.url,
    confidence: bestMatch.score,
  };
}

/**
 * Find matching courses from a list of detected topics.
 *
 * Takes the best match across all topics. Returns at most one suggestion.
 */
export function matchCourseFromTopics(topics: string[], minConfidence = 0.6): CourseSuggestion | null {
  let bestSuggestion: CourseSuggestion | null = null;

  for (const topic of topics) {
    const suggestion = matchCourse(topic, minConfidence);
    if (suggestion && (!bestSuggestion || suggestion.confidence > bestSuggestion.confidence)) {
      bestSuggestion = suggestion;
    }
  }

  return bestSuggestion;
}