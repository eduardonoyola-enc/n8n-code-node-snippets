/**
 * Exponential Backoff with Jitter for n8n Code Nodes
 *
 * Retry logic for transient API failures (429 rate limits, 503 service
 * unavailable, timeout errors).
 *
 * WHY EXPONENTIAL + JITTER:
 *   - Linear retry pounds the failing service and prolongs the outage
 *   - Pure exponential causes "thundering herd" when many clients retry
 *     at the same offsets
 *   - Adding jitter spreads retries randomly, letting the service recover
 *
 * USAGE PATTERN:
 *   Wrap any HTTP-calling logic in callWithRetry():
 *
 *   const result = await callWithRetry(
 *     () => fetch(url, options),
 *     { maxAttempts: 5, baseDelayMs: 1000 }
 *   );
 */

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate the delay for the Nth retry attempt.
 *
 * @param {number} attempt - 1-indexed retry attempt
 * @param {number} baseDelayMs - Initial delay
 * @param {number} maxDelayMs - Cap on delay (prevents runaway waits)
 * @returns {number} Delay in milliseconds with jitter applied
 */
function calculateBackoff(attempt, baseDelayMs = 1000, maxDelayMs = 30000) {
  // Exponential: 1s, 2s, 4s, 8s, 16s, 32s, ...
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);

  // Cap to prevent runaway delays
  const capped = Math.min(exponential, maxDelayMs);

  // Add jitter: random value between 0 and the calculated delay
  // This prevents synchronized retries from multiple clients
  const jitter = Math.random() * capped;

  return Math.floor(jitter);
}

/**
 * Determine if an error is worth retrying.
 *
 * @param {Error|object} error - Error from the failed call
 * @returns {boolean} True if retrying might succeed
 */
function isRetryable(error) {
  if (!error) return false;

  // HTTP status codes that suggest transient issues
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (error.statusCode && retryableStatuses.includes(error.statusCode)) {
    return true;
  }

  // Network-level errors
  const retryableMessages = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'socket hang up',
    'network timeout',
  ];

  const errMsg = (error.message || '').toLowerCase();
  return retryableMessages.some(m => errMsg.includes(m.toLowerCase()));
}

/**
 * Execute an async function with exponential backoff retry.
 *
 * @param {Function} asyncFn - Function returning a Promise
 * @param {object} options - Retry configuration
 * @returns {Promise} Result of the successful call
 * @throws {Error} If all retries are exhausted
 */
async function callWithRetry(asyncFn, options = {}) {
  const {
    maxAttempts = 5,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    onRetry = null, // Optional callback for logging
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;

      // Don't retry on permanent failures (400 bad request, 401 unauthorized, etc.)
      if (!isRetryable(error)) {
        throw error;
      }

      // Don't sleep after the final attempt
      if (attempt === maxAttempts) break;

      const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);

      if (onRetry) {
        onRetry({ attempt, maxAttempts, delayMs: delay, error: error.message });
      }

      await sleep(delay);
    }
  }

  // All retries exhausted — rethrow with context
  throw new Error(
    `Failed after ${maxAttempts} attempts. Last error: ${lastError.message}`
  );
}

// ============================================================================
// EXAMPLE USAGE IN n8n CODE NODE
// ============================================================================

const items = $input.all();
const results = [];

for (const item of items) {
  try {
    // Wrap any flaky operation in callWithRetry
    const data = await callWithRetry(
      async () => {
        const response = await fetch('https://api.example.com/data', {
          headers: { 'Authorization': 'Bearer ' + item.json.token },
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}`);
          err.statusCode = response.status;
          throw err;
        }

        return await response.json();
      },
      {
        maxAttempts: 4,
        baseDelayMs: 500,
        onRetry: (info) => {
          console.log(`Retry ${info.attempt}/${info.maxAttempts} after ${info.delayMs}ms: ${info.error}`);
        },
      }
    );

    results.push({ json: { ...item.json, api_data: data, status: 'success' } });
  } catch (error) {
    // After all retries failed — record the failure but don't crash the workflow
    results.push({
      json: {
        ...item.json,
        status: 'failed',
        error: error.message,
      },
    });
  }
}

return results;
