import { render, screen, act } from '@testing-library/react';
import { IndeterminateProgress } from './IndeterminateProgress';

// Mock timers for testing
jest.useFakeTimers();

describe('IndeterminateProgress', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('renders nothing when not active', () => {
    const { container } = render(<IndeterminateProgress isActive={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders progress indicator when active', () => {
    render(<IndeterminateProgress isActive={true} />);
    
    expect(screen.getByText('Adding anime to watchlist')).toBeInTheDocument();
    expect(screen.getByText('Fetching anime data')).toBeInTheDocument();
    expect(screen.getByText('Getting anime information from MyAnimeList')).toBeInTheDocument();
  });

  it('uses custom title when provided', () => {
    render(<IndeterminateProgress isActive={true} title="Custom Title" />);
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('progresses through phases over time', () => {
    render(<IndeterminateProgress isActive={true} />);
    
    // Initially should show first phase
    expect(screen.getByText('Fetching anime data')).toBeInTheDocument();
    
    // Fast-forward past first phase duration (2000ms)
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    
    // Should now show second phase
    expect(screen.getByText('Discovering relationships')).toBeInTheDocument();
  });

  it('shows elapsed time', () => {
    render(<IndeterminateProgress isActive={true} />);
    
    // Fast-forward 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    expect(screen.getByText('5s elapsed')).toBeInTheDocument();
  });

  it('shows extended time message for long operations', () => {
    render(<IndeterminateProgress isActive={true} />);
    
    // Fast-forward past 10 seconds
    act(() => {
      jest.advanceTimersByTime(11000);
    });
    
    expect(screen.getByText(/This is taking longer than usual/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <IndeterminateProgress isActive={true} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows all phase indicators', () => {
    render(<IndeterminateProgress isActive={true} />);
    
    // Should show all 4 phases in the indicator dots
    const phaseIndicators = screen.getAllByRole('generic').filter(el => 
      el.className.includes('w-2 h-2 rounded-full')
    );
    
    expect(phaseIndicators).toHaveLength(4);
  });

  it('resets when becoming inactive', () => {
    const { rerender } = render(<IndeterminateProgress isActive={true} />);
    
    // Fast-forward to second phase
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    
    expect(screen.getByText('Discovering relationships')).toBeInTheDocument();
    
    // Make inactive
    rerender(<IndeterminateProgress isActive={false} />);
    
    // Make active again
    rerender(<IndeterminateProgress isActive={true} />);
    
    // Should be back to first phase
    expect(screen.getByText('Fetching anime data')).toBeInTheDocument();
  });
});