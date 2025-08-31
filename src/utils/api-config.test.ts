import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApiBaseUrl, createApiUrl, apiFetch } from './api-config.js';

// Mock window object
const mockWindow = {
  location: {
    hostname: 'localhost',
    port: '3000'
  }
};

describe('API Configuration', () => {
  beforeEach(() => {
    // Reset any existing window mock
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getApiBaseUrl', () => {
    it('should return direct API URL for development', () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3000'
        }
      });
      
      const baseUrl = getApiBaseUrl();
      expect(baseUrl).toBe('http://localhost:3001');
    });

    it('should return direct API URL for production', () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'https:',
          hostname: 'example.com',
          port: '80'
        }
      });
      
      const baseUrl = getApiBaseUrl();
      expect(baseUrl).toBe('https://example.com:3001');
    });

    it('should return direct API URL for server-side', () => {
      // Mock server-side environment (no window.location)
      vi.stubGlobal('window', {});
      
      const baseUrl = getApiBaseUrl();
      expect(baseUrl).toBe('http://localhost:3001');
    });
  });

  describe('createApiUrl', () => {
    it('should create correct URL with development base URL', () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3000'
        }
      });
      
      const url = createApiUrl('/api/export/stats');
      expect(url).toBe('http://localhost:3001/api/export/stats');
    });

    it('should create correct URL with base URL', () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'https:',
          hostname: 'example.com',
          port: '80'
        }
      });
      
      const url = createApiUrl('/api/export/stats');
      expect(url).toBe('https://example.com:3001/api/export/stats');
    });

    it('should handle paths without leading slash', () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3000'
        }
      });
      
      const url = createApiUrl('api/export/stats');
      expect(url).toBe('http://localhost:3001/api/export/stats');
    });
  });

  describe('apiFetch', () => {
    it('should call fetch with correct URL and default headers', async () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3000'
        }
      });
      
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);
      
      await apiFetch('/api/export/stats');
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/export/stats', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should pass through options to fetch with default Content-Type', async () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3000'
        }
      });
      
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);
      
      const options = { method: 'POST', body: 'test' };
      await apiFetch('/api/export/stats', options);
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/export/stats', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should not set Content-Type for FormData', async () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3000'
        }
      });
      
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);
      
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');
      
      await apiFetch('/api/import/preview', { method: 'POST', body: formData });
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/import/preview', {
        method: 'POST',
        body: formData,
        headers: {}
      });
    });

    it('should allow overriding Content-Type header', async () => {
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          port: '3000'
        }
      });
      
      const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
      vi.stubGlobal('fetch', mockFetch);
      
      await apiFetch('/api/test', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/test', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    });
  });
});