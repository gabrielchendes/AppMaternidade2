/**
 * Robust JSON extraction and parsing utility for AI / LLM responses.
 *
 * Prevents common LLM response errors such as:
 * - "Unexpected non-whitespace character after JSON at position ..."
 * - Trailing/leading markdown code blocks (```json ... ```)
 * - Trailing or leading commentary after/before the JSON payload
 * - Raw unescaped newlines or control characters within string values
 * - Trailing commas before closing braces/brackets
 */

export function safeParseAiJson<T = any>(text: string, fallback?: T): T {
  if (!text || typeof text !== 'string') {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty AI response text');
  }

  const trimmed = text.trim();

  // Attempt 1: Direct parse
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // Attempt 2: Strip standard markdown fences
  const stripped = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch (_) {}

  // Attempt 3: Balanced-brace scanner to safely isolate the exact JSON object or array
  // This completely eliminates "Unexpected non-whitespace character after JSON" by ignoring
  // any text, backticks, or notes that appear after the matching closing brace.
  const firstCurly = trimmed.indexOf('{');
  const firstSquare = trimmed.indexOf('[');

  let startIdx = -1;
  let isArray = false;

  if (firstCurly !== -1 && firstSquare !== -1) {
    if (firstCurly < firstSquare) {
      startIdx = firstCurly;
      isArray = false;
    } else {
      startIdx = firstSquare;
      isArray = true;
    }
  } else if (firstCurly !== -1) {
    startIdx = firstCurly;
    isArray = false;
  } else if (firstSquare !== -1) {
    startIdx = firstSquare;
    isArray = true;
  }

  if (startIdx !== -1) {
    const openChar = isArray ? '[' : '{';
    const closeChar = isArray ? ']' : '}';

    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;

    for (let i = startIdx; i < trimmed.length; i++) {
      const ch = trimmed[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\') {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (ch === openChar) {
          depth++;
        } else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const balancedSubstring = trimmed.slice(startIdx, endIdx + 1).trim();
      try {
        return JSON.parse(balancedSubstring);
      } catch (_) {
        // Attempt 4: Clean potential trailing commas and unescaped control chars
        try {
          const sanitized = sanitizeJsonString(balancedSubstring);
          return JSON.parse(sanitized);
        } catch (_) {}
      }
    }
  }

  // Attempt 5: Slice between outermost braces as fallback
  const lastCurly = trimmed.lastIndexOf('}');
  if (firstCurly !== -1 && lastCurly > firstCurly) {
    const candidate = trimmed.slice(firstCurly, lastCurly + 1).trim();
    try {
      return JSON.parse(candidate);
    } catch (_) {
      try {
        return JSON.parse(sanitizeJsonString(candidate));
      } catch (_) {}
    }
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Failed to parse valid JSON from AI output: ${trimmed.slice(0, 180)}...`);
}

/**
 * Sanitizes JSON strings by removing trailing commas and escaping raw control characters
 */
function sanitizeJsonString(jsonStr: string): string {
  return jsonStr
    // Remove trailing commas in objects or arrays: { "a": 1, } -> { "a": 1 }
    .replace(/,\s*([\]}])/g, '$1')
    // Replace unescaped control characters (newlines, tabs, etc.)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '';
    });
}
