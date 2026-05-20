/**
 * Unicode Sanitizer for n8n Code Nodes
 *
 * Strips Unicode artifacts that silently break downstream APIs.
 *
 * THE BUG THIS SOLVES:
 *   Messages sent to Kommo CRM were being truncated unpredictably.
 *   Investigation showed Unicode Variation Selector-16 (U+FE0F) — the
 *   character that follows emojis like ✉️ ⭐ 🗺️ ☀️ ✏️ — was being
 *   interpreted as a control character by the CRM's text dispatcher.
 *   Everything after the FE0F was getting cut.
 *
 *   Zero-width characters (U+200B, U+200C, U+200D) and Byte-Order Marks
 *   (U+FEFF) cause similar issues across various REST APIs.
 *
 * USAGE IN n8n CODE NODE:
 *   const sanitized = sanitize($input.first().json.message);
 *   return [{ json: { sanitized } }];
 */

/**
 * Strip Unicode artifacts that break text-processing APIs.
 *
 * @param {string} text - Raw text input
 * @returns {string} Sanitized text safe for downstream APIs
 */
function stripUnicodeArtifacts(text) {
  if (text === null || text === undefined) return '';
  if (typeof text !== 'string') {
    // Defensive: handle numbers, booleans without crashing the workflow
    return String(text);
  }

  return text
    // Variation Selector-16 — most common offender, follows certain emojis
    .replace(/\uFE0F/g, '')
    // Zero-width spaces, joiners, non-joiners
    .replace(/[\u200B-\u200D]/g, '')
    // Byte-Order Mark (sometimes prepended by Windows tools)
    .replace(/\uFEFF/g, '')
    // Other invisible formatting characters (Mongolian vowel separator, etc.)
    .replace(/[\u180E\u2060]/g, '');
}

/**
 * Returns a list of emoji-friendly alternatives that DON'T contain FE0F.
 * Useful for prompt engineering — instruct the LLM to use these instead.
 */
const SAFE_EMOJI_ALTERNATIVES = {
  '✉️': '📧',  // mail envelope → e-mail symbol
  '⭐': '🌟',  // star → glowing star
  '🗺️': '🌍',  // world map → globe
  '☀️': '🌞',  // sun → sun with face
  '✏️': '📝',  // pencil → memo
};

/**
 * Replace risky emojis with safe equivalents.
 * Use this BEFORE sending messages to CRMs/APIs that don't handle FE0F.
 */
function replaceRiskyEmojis(text) {
  let result = text;
  for (const [risky, safe] of Object.entries(SAFE_EMOJI_ALTERNATIVES)) {
    result = result.split(risky).join(safe);
  }
  return result;
}

// ============================================================================
// EXAMPLE USAGE IN n8n CODE NODE
// ============================================================================

const items = $input.all();

return items.map(item => {
  const rawMessage = item.json.message || '';

  return {
    json: {
      ...item.json,
      message_sanitized: stripUnicodeArtifacts(rawMessage),
      message_safe_emojis: replaceRiskyEmojis(stripUnicodeArtifacts(rawMessage)),
      // Diagnostic info — remove in production once you trust it
      _debug: {
        original_length: rawMessage.length,
        sanitized_length: stripUnicodeArtifacts(rawMessage).length,
        had_variation_selectors: /\uFE0F/.test(rawMessage),
      },
    },
  };
});
