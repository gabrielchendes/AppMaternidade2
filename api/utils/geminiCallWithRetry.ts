import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';

export interface GeminiRetryOptions {
  ai: GoogleGenAI;
  candidateModels?: string[];
  contents: GenerateContentParameters['contents'];
  config?: GenerateContentParameters['config'];
  maxAttemptsPerModel?: number;
  baseDelayMs?: number;
  logPrefix?: string;
}

/**
 * Checks whether an error is transient and eligible for backoff retry.
 * Google Gemini returns 503 (UNAVAILABLE) during demand spikes and 429 when rate limits are hit.
 */
export function isRetryableGeminiError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  const status = error.status || error.code || error.statusCode;

  if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504) {
    return true;
  }

  if (
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota exceeded') ||
    msg.includes('overloaded') ||
    msg.includes('try again later') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  ) {
    return true;
  }

  return false;
}

/**
 * Executes a Gemini content generation with intelligent multi-model fallback and exponential backoff.
 */
export async function generateContentWithRetry(
  options: GeminiRetryOptions
): Promise<{ text: string; modelUsed: string; response: GenerateContentResponse }> {
  const {
    ai,
    candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
    contents,
    config,
    maxAttemptsPerModel = 2,
    baseDelayMs = 1200,
    logPrefix = '[Gemini Call]'
  } = options;

  let lastError: any = null;

  for (const modelName of candidateModels) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        if (response.text) {
          return {
            text: response.text,
            modelUsed: modelName,
            response,
          };
        }
      } catch (err: any) {
        lastError = err;
        const isRetryable = isRetryableGeminiError(err);
        const errMsg = err?.message || String(err);

        console.warn(
          `${logPrefix} Model ${modelName} (attempt ${attempt}/${maxAttemptsPerModel}) error:`,
          errMsg
        );

        if (!isRetryable && attempt === 1) {
          // If not a retryable transient network/demand error, move directly to next candidate model
          break;
        }

        // Calculate exponential backoff with randomized jitter
        const delay = Math.round(
          baseDelayMs * Math.pow(1.8, attempt - 1) + Math.random() * 400
        );

        if (attempt < maxAttemptsPerModel || modelName !== candidateModels[candidateModels.length - 1]) {
          console.info(`${logPrefix} Waiting ${delay}ms before retrying or switching models...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError || new Error(`${logPrefix} All candidate models failed to generate content.`);
}
