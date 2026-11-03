/**
 * Safe API client utility to prevent "Unexpected token '<', <!doctype ... is not valid JSON"
 * errors when server is restarting, returning 502/503/404 HTML, or encountering network issues.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
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
      };
    }

    // Server returned JSON
    const json = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: json,
        error: json.error || json.message || `Request failed with status ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: json,
      error: undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err.message || 'Network connection failed.',
    };
  }
}
