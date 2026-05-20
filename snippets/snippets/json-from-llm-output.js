/**
 * Safe JSON Extraction from LLM Free-Form Output
 *
 * Pulls structured JSON from an LLM's natural-language response without
 * breaking on malformed output.
 *
 * THE PROBLEM:
 *   LLMs often need to return both natural-language text (for the user)
 *   AND structured data (for downstream automation). The common pattern
 *   is to ask the LLM to emit JSON inside ```json code blocks within its
 *   prose response.
 *
 *   But LLMs are imperfect:
 *   - Sometimes they forget the code fence
 *   - Sometimes they put extra commentary inside the code fence
 *   - Sometimes the JSON has trailing commas (valid in JS, invalid in JSON)
 *   - Sometimes they emit multiple JSON blocks
 *
 *   A naive JSON.parse() will crash your workflow. This snippet doesn't.
 *
 * USAGE:
 *   const extracted = extractJsonFromLlmOutput($input.first().json.output);
 *   return [{ json: { extracted } }];
 */

/**
 * Extract a JSON object from LLM free-form output.
 * Falls back gracefully if parsing fails.
 *
 * @param {string} text - LLM response that may contain a JSON block
 * @param {object} fallback - Default object if extraction fails (default: {})
 * @returns {object} Parsed JSON or fallback
 */
function extractJsonFromLlmOutput(text, fallback = {}) {
  if (!text || typeof text !== 'string') return fallback;

  // Strategy 1: Look for explicit ```json fenced block
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fencedMatch) {
    const parsed = safeJsonParse(fencedMatch[1]);
    if (parsed !== null) return parsed;
  }

  // Strategy 2: Look for the first top-level { ... } block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    const parsed = safeJsonParse(braceMatch[0]);
    if (parsed !== null) return parsed;
  }

  // Strategy 3: Maybe the entire text is JSON
  const wholeParsed = safeJsonParse(text);
  if (wholeParsed !== null) return wholeParsed;

  // Nothing worked — return fallback so the workflow can continue
  return fallback;
}

/**
 * JSON.parse that returns null on failure instead of throwing.
 * Also handles common LLM mistakes like trailing commas.
 */
function safeJsonParse(str) {
  if (!str) return null;

  // First try a direct parse
  try {
    return JSON.parse(str);
  } catch (e) {
    // Try to fix common LLM JSON issues
    try {
      const cleaned = str
        // Remove trailing commas before } or ]
        .replace(/,(\s*[}\]])/g, '$1')
        // Remove single-line comments LLMs sometimes add
        .replace(/\/\/[^\n]*/g, '')
        // Remove multi-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '');

      return JSON.parse(cleaned);
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Extract ALL JSON blocks from text (useful when the LLM emits multiple).
 */
function extractAllJsonFromLlmOutput(text) {
  if (!text || typeof text !== 'string') return [];

  const results = [];
  const fencedPattern = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match;

  while ((match = fencedPattern.exec(text)) !== null) {
    const parsed = safeJsonParse(match[1]);
    if (parsed !== null) results.push(parsed);
  }

  return results;
}

// ============================================================================
// EXAMPLE USAGE IN n8n CODE NODE
// ============================================================================

const items = $input.all();

return items.map(item => {
  const llmOutput = item.json.output || item.json.text || '';

  // Extract with sensible fallback that won't break downstream nodes
  const extracted = extractJsonFromLlmOutput(llmOutput, {
    detected_stage: 'UNKNOWN',
    confidence: 0,
    escalate_to_human: true, // Safe default — escalate when we can't parse
  });

  return {
    json: {
      ...item.json,
      structured_output: extracted,
      // Keep the prose for sending back to the user
      prose_response: llmOutput.replace(/```(?:json)?\s*[\s\S]*?\s*```/g, '').trim(),
    },
  };
});
