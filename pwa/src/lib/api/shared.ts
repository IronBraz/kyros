import { ApiResponse } from '@/types/shared';

// Empty means "same origin": on Vercel the SPA and the API function share one host, so
// /api/v1/* resolves without CORS. Overridable at build time only to point a local dev
// build at a preview deployment; leave it unset in production.
export const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// Generic error handler for API responses
export const handleApiError = async (res: Response): Promise<ApiResponse<any>> => {
  if (!res.ok) {
    const text = await res.text();
    console.error(`API error: ${res.status}`, text);
    return {
      success: false,
      error: {
        code: 'HTTP_ERROR',
        message: `Server returned ${res.status}: ${text.slice(0, 100)}`
      }
    };
  }
  return res.json();
};
