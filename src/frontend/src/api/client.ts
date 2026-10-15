const DEFAULT_API_URL = import.meta.env.VITE_API_URL || '/api';
const DEFAULT_API_KEY = 'dev-secret-key';

export function getApiUrl(): string {
  return localStorage.getItem('stock_screener_api_url') || DEFAULT_API_URL;
}

export function setApiUrl(url: string): void {
  localStorage.setItem('stock_screener_api_url', url);
}

export function getApiKey(): string {
  return localStorage.getItem('stock_screener_api_key') || DEFAULT_API_KEY;
}

export function setApiKey(key: string): void {
  localStorage.setItem('stock_screener_api_key', key);
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiUrl().replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  const apiKey = getApiKey();
  if (apiKey) {
    headers.set('X-API-KEY', apiKey);
  }

  // If body is not FormData and Content-Type not set, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    let responseData = null;
    try {
      responseData = await response.json();
      if (responseData && responseData.detail) {
        if (typeof responseData.detail === 'string') {
          errorDetail = responseData.detail;
        } else if (Array.isArray(responseData.detail)) {
          errorDetail = responseData.detail.map((d: any) => `${d.loc?.join('.')}: ${d.msg}`).join(', ');
        }
      }
    } catch {
      // Ignore json parse error
    }

    if (response.status === 401) {
      errorDetail = 'Ungültiger oder fehlender API-Schlüssel (X-API-KEY). Bitte in den Einstellungen prüfen.';
    } else if (response.status === 404) {
      errorDetail = errorDetail || 'Die angeforderte Ressource wurde nicht gefunden.';
    }

    throw new ApiError(response.status, errorDetail || `Fehler ${response.status}`, responseData);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const api = {
  get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    return request<T>(url, { method: 'GET' });
  },

  post<T>(endpoint: string, body?: any): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: any): Promise<T> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, {
      method: 'DELETE',
    });
  },

  postForm<T>(endpoint: string, formData: FormData): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  },
};
