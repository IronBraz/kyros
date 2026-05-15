import { ApiResponse } from '@/types/shared';

// Use relative path to leverage Caddy proxy (avoids CORS issues)
export const API_BASE = '';

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
