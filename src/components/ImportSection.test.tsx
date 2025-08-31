import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportSection } from './ImportSection';
import type { ImportPreview, ValidationResult, ImportResult } from '../types/export-import';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock file for testing
const createMockFile = (name: string, content: string, type: string = 'application/json') => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

// Mock data
const mockValidationResult: ValidationResult = {
  isValid: true,
  errors: [],
  warnings: [],
  metadata: {
    version: '1.0.0',
    exportDate: '2023-01-01T00:00:00.000Z',
    totalRecords: 100,
    checksum: 'abc123',
    application: {
      name: 'Project Claw',
      version: '1.0.0'
    }
  }
};

const mockImportPreview: ImportPreview = {
  metadata: {
    version: '1.0.0',
    exportDate: '2023-01-01T00:00:00.000Z',
    totalRecords: 100,
    checksum: 'abc123',
    application: {
      name: 'Project Claw',
      version: '1.0.0'
    }
  },
  summary: {
    animeInfo: 50,
    userWatchlist: 30,
    animeRelationships: 15,
    timelineCache: 5
  },
  conflicts: {
    duplicateAnime: [
      { malId: 1, title: 'Test Anime', existingTitle: 'Test Anime' }
    ],
    duplicateWatchlistEntries: [
      { animeInfoId: 1, title: 'Test Anime' }
    ]
  },
  schemaMigrationRequired: false,
  estimatedProcessingTime: 30
};

const mockImportResult: ImportResult = {
  success: true,
  recordsProcessed: {
    animeInfo: 50,
    userWatchlist: 30,
    animeRelationships: 15,
    timelineCache: 5
  },
  errors: [],
  warnings: []
};

describe('ImportSection', () => {
  const user = userEvent.setup();
  const mockOnStatsUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders import section with initial state', () => {
    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    expect(screen.getByText('Import Data')).toBeInTheDocument();
    expect(screen.getByText('Drop your import file here')).toBeInTheDocument();
    expect(screen.getByText('browse to upload')).toBeInTheDocument();
    expect(screen.getByText('JSON files only, max 50MB')).toBeInTheDocument();
  });

  it('handles file selection via input', async () => {
    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    
    expect(screen.getByText('test-export.json')).toBeInTheDocument();
    expect(screen.getByText(/Selected file: test-export.json/)).toBeInTheDocument();
    expect(screen.getByText('Validate File')).toBeInTheDocument();
  });

  it('rejects non-JSON files', async () => {
    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file') as HTMLInputElement;
    const testFile = createMockFile('test.txt', 'test content', 'text/plain');
    
    // Manually trigger the change event
    Object.defineProperty(fileInput, 'files', {
      value: [testFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText('Please select a JSON file')).toBeInTheDocument();
    });
    expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
  });

  it('handles drag and drop file upload', async () => {
    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const dropZone = screen.getByText('Drop your import file here').closest('div');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    // Simulate drag over
    fireEvent.dragOver(dropZone!, {
      dataTransfer: {
        files: [testFile]
      }
    });
    
    // Simulate drop
    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [testFile]
      }
    });
    
    expect(screen.getByText('test-export.json')).toBeInTheDocument();
    expect(screen.getByText(/Selected file: test-export.json/)).toBeInTheDocument();
  });

  it('validates file successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    // Mock preview request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('File validation successful')).toBeInTheDocument();
    });

    // Should automatically show preview
    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument(); // animeInfo count
      expect(screen.getByText('30')).toBeInTheDocument(); // userWatchlist count
    });
  });

  it('handles validation errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          isValid: false,
          errors: [{ code: 'INVALID_FORMAT', message: 'Invalid JSON format' }],
          warnings: []
        }
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', 'invalid json');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText(/File validation failed: Invalid JSON format/)).toBeInTheDocument();
    });
  });

  it('displays import preview with conflicts', async () => {
    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    // Simulate having a preview (would normally come from validation)
    const component = screen.getByText('Import Data').closest('div');
    
    // We need to trigger the preview state manually since it's internal
    // This would normally happen after successful validation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Preview')).toBeInTheDocument();
      expect(screen.getByText('Potential Conflicts')).toBeInTheDocument();
      expect(screen.getByText('1 duplicate anime entries found')).toBeInTheDocument();
      expect(screen.getByText('1 duplicate watchlist entries found')).toBeInTheDocument();
    });
  });

  it('shows import options after preview', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Options')).toBeInTheDocument();
      expect(screen.getByText('Import Mode')).toBeInTheDocument();
      expect(screen.getByText('Merge - Add new data and update existing records')).toBeInTheDocument();
      expect(screen.getByText('Replace - Clear existing data and import fresh')).toBeInTheDocument();
      expect(screen.getByText('Start Import')).toBeInTheDocument();
    });
  });

  it('handles import mode changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Options')).toBeInTheDocument();
    });

    // Switch to replace mode
    const replaceRadio = screen.getByDisplayValue('replace');
    await user.click(replaceRadio);
    
    expect(replaceRadio).toBeChecked();
    
    // Duplicate handling options should not be visible in replace mode
    expect(screen.queryByText('Handle Duplicates')).not.toBeInTheDocument();
  });

  it('shows duplicate handling options in merge mode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Handle Duplicates')).toBeInTheDocument();
      expect(screen.getByText('Skip - Keep existing records unchanged')).toBeInTheDocument();
      expect(screen.getByText('Update - Overwrite existing records with imported data')).toBeInTheDocument();
    });
  });

  it('executes import successfully', async () => {
    // Mock validation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    // Mock preview
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    // Mock import execution
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportResult
      })
    });

    // Mock stats refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          animeInfo: 100,
          userWatchlist: 50,
          animeRelationships: 25,
          timelineCache: 10,
          totalRecords: 185,
          lastUpdated: new Date().toISOString()
        }
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Start Import')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Start Import'));
    
    await waitFor(() => {
      expect(screen.getByText(/Import completed! Processed 100 records/)).toBeInTheDocument();
    });

    // Should call stats update callback
    await waitFor(() => {
      expect(mockOnStatsUpdate).toHaveBeenCalled();
    });
  });

  it('handles import errors', async () => {
    // Mock validation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    // Mock preview
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    // Mock import execution failure
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: {
          code: 'IMPORT_FAILED',
          message: 'Database connection failed',
          timestamp: new Date().toISOString()
        }
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Start Import')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Start Import'));
    
    await waitFor(() => {
      expect(screen.getByText(/Import failed: Database connection failed/)).toBeInTheDocument();
    });
  });

  it('clears import state when clear button is clicked', async () => {
    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    
    expect(screen.getByText('test-export.json')).toBeInTheDocument();
    
    await user.click(screen.getByText('Clear'));
    
    expect(screen.queryByText('test-export.json')).not.toBeInTheDocument();
    expect(screen.getByText('Drop your import file here')).toBeInTheDocument();
  });

  it('handles checkbox option changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockImportPreview
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Options')).toBeInTheDocument();
    });

    const validateRelationshipsCheckbox = screen.getByLabelText('Validate relationships during import');
    const clearCacheCheckbox = screen.getByLabelText('Clear timeline cache after import');
    
    expect(validateRelationshipsCheckbox).toBeChecked();
    expect(clearCacheCheckbox).not.toBeChecked();
    
    await user.click(validateRelationshipsCheckbox);
    await user.click(clearCacheCheckbox);
    
    expect(validateRelationshipsCheckbox).not.toBeChecked();
    expect(clearCacheCheckbox).toBeChecked();
  });

  it('shows schema migration warning when required', async () => {
    const previewWithMigration = {
      ...mockImportPreview,
      schemaMigrationRequired: true
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockValidationResult
      })
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: previewWithMigration
      })
    });

    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    await user.click(screen.getByText('Validate File'));
    
    await waitFor(() => {
      expect(screen.getByText('Schema Migration Required')).toBeInTheDocument();
      expect(screen.getByText(/This file uses an older schema version/)).toBeInTheDocument();
    });
  });

  it('disables buttons during operations', async () => {
    render(<ImportSection onStatsUpdate={mockOnStatsUpdate} />);
    
    const fileInput = screen.getByLabelText('Select import file');
    const testFile = createMockFile('test-export.json', '{"test": "data"}');
    
    await user.upload(fileInput, testFile);
    
    const validateButton = screen.getByText('Validate File');
    
    // Mock a slow validation response
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: mockValidationResult
          })
        }), 100)
      )
    );

    await user.click(validateButton);
    
    // Button should be disabled during validation
    expect(screen.getByText('Validating...')).toBeInTheDocument();
    expect(validateButton).toBeDisabled();
  });
});