/**
 * Safe API client utility to prevent "Unexpected token '<', <!doctype ... is not valid JSON"
 * errors when server is restarting, returning 502/503/404 HTML, or encountering network issues.
 * Also standardizes AI model quota and rate limit errors into polished SaaS messages.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  isQuotaExceeded?: boolean;
  retryAfterSeconds?: number;
}

export const SAAS_AI_QUOTA_MESSAGE =
  '⚡ AI Service at Peak Capacity: Our cloud AI engine is currently processing an unusually high volume of creator requests. Your request has been queued. Please wait a few seconds and try again, or continue using our creator workspace.';

/**
 * Checks if an error string or object represents a Gemini / AI API quota or rate limit error
 */
export function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    if (err.isQuotaExceeded || err.status === 429 || err.code === 429 || err.code === 'AI_QUOTA_EXCEEDED') {
      return true;
    }
  }
  const str = (typeof err === 'string' ? err : err.message || JSON.stringify(err)).toLowerCase();
  return (
    str.includes('429') ||
    str.includes('resource_exhausted') ||
    str.includes('quota exceeded') ||
    str.includes('rate limit') ||
    str.includes('too many requests') ||
    str.includes('exceeded your current quota') ||
    str.includes('limit: 0') ||
    str.includes('free tier') ||
    str.includes('rate-limits') ||
    str.includes('generativelanguage.googleapis.com')
  );
}

/**
 * Sanitizes any raw Google GenAI API or HTTP error string into a polished, professional SaaS message
 */
export function sanitizeErrorMessage(
  rawError?: string,
  defaultFallback: string = 'An unexpected error occurred. Please try again.'
): {
  message: string;
  isQuota: boolean;
} {
  if (!rawError) {
    return { message: defaultFallback, isQuota: false };
  }

  if (isQuotaExceededError(rawError)) {
    return {
      message: SAAS_AI_QUOTA_MESSAGE,
      isQuota: true,
    };
  }

  // If the error looks like raw JSON string: e.g. {"error": {"message": "..."}}
  try {
    const trimmed = rawError.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed?.error?.message) {
        if (isQuotaExceededError(parsed.error.message)) {
          return { message: SAAS_AI_QUOTA_MESSAGE, isQuota: true };
        }
        return { message: parsed.error.message, isQuota: false };
      }
    }
  } catch {
    // not JSON, proceed
  }

  return { message: rawError, isQuota: false };
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    // If server returned HTML (e.g. 502 Gateway, 404 HTML, or index.html fallback)
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      const isHtml = text.trim().startsWith('<');
      const errorMsg = isHtml
        ? `Server returned an HTML response (${res.status} ${res.statusText || 'Error'}). Please try again.`
        : text.slice(0, 150) || `Request failed with status ${res.status}`;

      return {
        ok: false,
        status: res.status,
        error: errorMsg,
        isQuotaExceeded: res.status === 429,
      };
    }

    // Server returned JSON
    const json = await res.json();

    const isQuota =
      res.status === 429 ||
      json.isQuotaExceeded === true ||
      json.code === 'AI_QUOTA_EXCEEDED' ||
      isQuotaExceededError(json.error || json.message);

    if (!res.ok) {
      const rawError = json.error || json.message || `Request failed with status ${res.status}`;
      const { message } = sanitizeErrorMessage(rawError);

      return {
        ok: false,
        status: res.status,
        data: json,
        error: isQuota ? SAAS_AI_QUOTA_MESSAGE : message,
        isQuotaExceeded: isQuota,
        retryAfterSeconds: json.retryAfterSeconds || (isQuota ? 25 : undefined),
      };
    }

    return {
      ok: true,
      status: res.status,
      data: json,
      error: undefined,
      isQuotaExceeded: false,
    };
  } catch (err: any) {
    const isQuota = isQuotaExceededError(err);
    const { message } = sanitizeErrorMessage(err?.message || 'Network connection failed.');
    return {
      ok: false,
      status: 0,
      error: isQuota ? SAAS_AI_QUOTA_MESSAGE : message,
      isQuotaExceeded: isQuota,
    };
  }
}
