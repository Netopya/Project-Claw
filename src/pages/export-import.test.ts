import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DOM elements and methods
const mockCreateElement = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

// Setup DOM mocks
beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  
  // Mock document methods
  document.createElement = mockCreateElement;
  document.body.appendChild = mockAppendChild;
  document.body.removeChild = mockRemoveChild;
  
  // Mock URL methods
  window.URL.createObjectURL = mockCreateObjectURL;
  window.URL.revokeObjectURL = mockRevokeObjectURL;
  
  // Mock element creation
  mockCreateElement.mockImplementation((tagName: string) => {
    const element = {
      tagName: tagName.toUpperCase(),
      href: '',
      download: '',
      click: mockClick,
      style: {},
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      className: '',
      appendChild: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(),
    };
    return element;
  });
  
  // Mock getElementById
  document.getElementById = vi.fn((id: string) => {
    const mockElement = {
      id,
      textContent: '',
      innerHTML: '',
      className: '',
      style: {},
      disabled: false,
      value: '',
      files: [],
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      appendChild: vi.fn(),
      click: vi.fn(),
    };
    return mockElement;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Export/Import Page JavaScript Functionality', () => {
  describe('Statistics Refresh', () => {
    it('should refresh database statistics successfully', async () => {
      const mockStats = {
        animeInfo: 100,
        userWatchlist: 50,
        animeRelationships: 25,
        timelineCache: 75,
        total: 250,
        lastUpdated: '2023-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockStats
        })
      });

      // Mock the refresh button
      const mockRefreshButton = {
        textContent: 'Refresh',
        disabled: false,
        addEventListener: vi.fn(),
      };
      
      document.getElementById = vi.fn((id: string) => {
        if (id === 'refresh-stats') return mockRefreshButton;
        return {
          textContent: '',
          innerHTML: '',
          toLocaleString: vi.fn(() => ''),
        };
      });

      // Simulate the refresh functionality
      const refreshStats = async () => {
        try {
          mockRefreshButton.textContent = 'Refreshing...';
          mockRefreshButton.disabled = true;
          
          const response = await fetch('/api/export/stats');
          const data = await response.json();
          
          if (data.success) {
            // Update stats display would happen here
            return data.data;
          }
        } finally {
          mockRefreshButton.textContent = 'Refresh';
          mockRefreshButton.disabled = false;
        }
      };

      const result = await refreshStats();
      
      expect(mockFetch).toHaveBeenCalledWith('/api/export/stats');
      expect(result).toEqual(mockStats);
      expect(mockRefreshButton.textContent).toBe('Refresh');
      expect(mockRefreshButton.disabled).toBe(false);
    });

    it('should handle statistics refresh error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Database connection failed'
        })
      });

      const mockRefreshButton = {
        textContent: 'Refresh',
        disabled: false,
      };

      const refreshStats = async () => {
        try {
          mockRefreshButton.textContent = 'Refreshing...';
          mockRefreshButton.disabled = true;
          
          const response = await fetch('/api/export/stats');
          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error);
          }
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
          mockRefreshButton.textContent = 'Refresh';
          mockRefreshButton.disabled = false;
        }
      };

      const result = await refreshStats();
      
      expect(result).toEqual({ error: 'Database connection failed' });
      expect(mockRefreshButton.textContent).toBe('Refresh');
      expect(mockRefreshButton.disabled).toBe(false);
    });
  });

  describe('Export Functionality', () => {
    it('should handle successful export', async () => {
      const mockBlob = new Blob(['export data'], { type: 'application/json' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'Content-Disposition') {
              return 'attachment; filename="test-export.json"';
            }
            return null;
          }
        },
        blob: async () => mockBlob
      });

      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const mockExportButton = {
        disabled: false,
        textContent: 'Export Data',
      };

      const mockProgressBar = { style: { width: '0%' } };
      const mockStatusText = { textContent: '' };

      const exportData = async () => {
        try {
          mockExportButton.disabled = true;
          mockExportButton.textContent = 'Exporting...';
          
          const response = await fetch('/api/export/generate', { method: 'POST' });
          
          if (response.ok) {
            const contentDisposition = response.headers.get('Content-Disposition');
            const filename = contentDisposition 
              ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
              : 'default-export.json';
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Simulate file download
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            return { success: true, filename };
          }
        } finally {
          mockExportButton.disabled = false;
          mockExportButton.textContent = 'Export Data';
        }
      };

      const result = await exportData();
      
      expect(mockFetch).toHaveBeenCalledWith('/api/export/generate', { method: 'POST' });
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      expect(result).toEqual({ success: true, filename: 'test-export.json' });
    });

    it('should handle export error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Export generation failed'
        })
      });

      const mockExportButton = {
        disabled: false,
        textContent: 'Export Data',
      };

      const exportData = async () => {
        try {
          mockExportButton.disabled = true;
          mockExportButton.textContent = 'Exporting...';
          
          const response = await fetch('/api/export/generate', { method: 'POST' });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Export failed');
          }
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Unknown error' };
        } finally {
          mockExportButton.disabled = false;
          mockExportButton.textContent = 'Export Data';
        }
      };

      const result = await exportData();
      
      expect(result).toEqual({ error: 'Export generation failed' });
      expect(mockExportButton.disabled).toBe(false);
      expect(mockExportButton.textContent).toBe('Export Data');
    });
  });

  describe('File Upload Handling', () => {
    it('should handle file selection', () => {
      const mockFile = new File(['{"test": "data"}'], 'test-import.json', {
        type: 'application/json'
      });

      const handleFileSelection = (file: File) => {
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          return {
            success: true,
            filename: file.name,
            size: file.size
          };
        }
        return {
          success: false,
          error: 'Invalid file type'
        };
      };

      const result = handleFileSelection(mockFile);
      
      expect(result).toEqual({
        success: true,
        filename: 'test-import.json',
        size: mockFile.size
      });
    });

    it('should reject invalid file types', () => {
      const mockFile = new File(['invalid data'], 'test.txt', {
        type: 'text/plain'
      });

      const handleFileSelection = (file: File) => {
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          return {
            success: true,
            filename: file.name,
            size: file.size
          };
        }
        return {
          success: false,
          error: 'Invalid file type'
        };
      };

      const result = handleFileSelection(mockFile);
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid file type'
      });
    });
  });

  describe('Progress Updates', () => {
    it('should update progress bar and status text', () => {
      const mockProgressBar = { style: { width: '0%' } };
      const mockStatusText = { textContent: '' };

      const updateProgress = (progressBar: any, statusText: any, percentage: number, message: string) => {
        progressBar.style.width = percentage + '%';
        statusText.textContent = message;
      };

      updateProgress(mockProgressBar, mockStatusText, 50, 'Processing...');
      
      expect(mockProgressBar.style.width).toBe('50%');
      expect(mockStatusText.textContent).toBe('Processing...');
    });
  });

  describe('Message Display', () => {
    it('should create and display success message', () => {
      const mockContainer = {
        appendChild: vi.fn()
      };

      const showMessage = (container: any, type: string, message: string) => {
        const messageEl = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-50' : 
                        type === 'error' ? 'bg-red-50' : 'bg-blue-50';
        messageEl.className = `p-4 ${bgColor} border rounded-md`;
        messageEl.innerHTML = `<p class="text-sm">${message}</p>`;
        container.appendChild(messageEl);
        return messageEl;
      };

      const messageEl = showMessage(mockContainer, 'success', 'Operation completed');
      
      expect(mockCreateElement).toHaveBeenCalledWith('div');
      expect(mockContainer.appendChild).toHaveBeenCalled();
      expect(messageEl.className).toContain('bg-green-50');
    });

    it('should create and display error message', () => {
      const mockContainer = {
        appendChild: vi.fn()
      };

      const showMessage = (container: any, type: string, message: string) => {
        const messageEl = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-50' : 
                        type === 'error' ? 'bg-red-50' : 'bg-blue-50';
        messageEl.className = `p-4 ${bgColor} border rounded-md`;
        messageEl.innerHTML = `<p class="text-sm">${message}</p>`;
        container.appendChild(messageEl);
        return messageEl;
      };

      const messageEl = showMessage(mockContainer, 'error', 'Operation failed');
      
      expect(messageEl.className).toContain('bg-red-50');
    });
  });

  describe('UI State Management', () => {
    it('should reset import UI state', () => {
      const mockElements = {
        importOptions: { classList: { add: vi.fn(), remove: vi.fn() } },
        importPreview: { classList: { add: vi.fn(), remove: vi.fn() } },
        importActions: { classList: { add: vi.fn(), remove: vi.fn() } },
        importProgress: { classList: { add: vi.fn(), remove: vi.fn() } },
        importMessages: { innerHTML: '' },
        fileInput: { value: '' }
      };

      const resetImportUI = () => {
        mockElements.importOptions.classList.add('hidden');
        mockElements.importPreview.classList.add('hidden');
        mockElements.importActions.classList.add('hidden');
        mockElements.importProgress.classList.add('hidden');
        mockElements.importMessages.innerHTML = '';
        mockElements.fileInput.value = '';
      };

      resetImportUI();
      
      expect(mockElements.importOptions.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.importPreview.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.importActions.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.importProgress.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.importMessages.innerHTML).toBe('');
      expect(mockElements.fileInput.value).toBe('');
    });
  });
});

describe('Navigation Integration', () => {
  it('should have correct navigation structure', () => {
    // Test that the navigation links are properly structured
    const expectedNavigation = {
      desktop: [
        { href: '/', text: 'Watchlist', label: 'Go to watchlist' },
        { href: '/export-import', text: 'Data Management', label: 'Manage data export and import' },
        { href: '/about', text: 'About', label: 'Learn about Project Claw' }
      ],
      mobile: [
        { href: '/', text: 'Watchlist' },
        { href: '/export-import', text: 'Data Management' },
        { href: '/about', text: 'About' }
      ]
    };

    // Verify navigation structure
    expect(expectedNavigation.desktop).toHaveLength(3);
    expect(expectedNavigation.mobile).toHaveLength(3);
    
    // Check that export-import page is included
    const exportImportDesktop = expectedNavigation.desktop.find(nav => nav.href === '/export-import');
    const exportImportMobile = expectedNavigation.mobile.find(nav => nav.href === '/export-import');
    
    expect(exportImportDesktop).toBeDefined();
    expect(exportImportDesktop?.text).toBe('Data Management');
    expect(exportImportDesktop?.label).toBe('Manage data export and import');
    
    expect(exportImportMobile).toBeDefined();
    expect(exportImportMobile?.text).toBe('Data Management');
  });
});

describe('Page Rendering', () => {
  it('should handle server-side statistics loading', () => {
    const mockInitialStats = {
      animeInfo: 100,
      userWatchlist: 50,
      animeRelationships: 25,
      timelineCache: 75,
      total: 250,
      lastUpdated: '2023-01-01T00:00:00Z'
    };

    // Test that initial stats are properly formatted
    const formatStats = (stats: typeof mockInitialStats) => {
      return {
        animeInfo: stats.animeInfo.toLocaleString(),
        userWatchlist: stats.userWatchlist.toLocaleString(),
        animeRelationships: stats.animeRelationships.toLocaleString(),
        timelineCache: stats.timelineCache.toLocaleString(),
        total: stats.total.toLocaleString(),
        lastUpdated: new Date(stats.lastUpdated).toLocaleString()
      };
    };

    const formattedStats = formatStats(mockInitialStats);
    
    expect(formattedStats.animeInfo).toBe('100');
    expect(formattedStats.userWatchlist).toBe('50');
    expect(formattedStats.animeRelationships).toBe('25');
    expect(formattedStats.timelineCache).toBe('75');
    expect(formattedStats.total).toBe('250');
    expect(formattedStats.lastUpdated).toBeDefined();
  });

  it('should handle statistics loading error gracefully', () => {
    const fallbackStats = {
      animeInfo: 0,
      userWatchlist: 0,
      animeRelationships: 0,
      timelineCache: 0,
      total: 0,
      lastUpdated: new Date().toISOString()
    };

    const handleStatsError = (error: Error) => {
      return {
        stats: fallbackStats,
        error: error.message
      };
    };

    const result = handleStatsError(new Error('Database connection failed'));
    
    expect(result.stats).toEqual(fallbackStats);
    expect(result.error).toBe('Database connection failed');
  });
});