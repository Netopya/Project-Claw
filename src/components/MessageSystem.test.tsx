import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageSystem, useMessageSystem, type Message } from './MessageSystem';

const createMockMessage = (overrides: Partial<Message> = {}): Message => ({
  id: '1',
  type: 'info',
  message: 'Test message',
  timestamp: new Date('2023-01-01T12:00:00Z'),
  autoRemove: false,
  ...overrides
});

describe('MessageSystem', () => {
  const mockOnRemoveMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders messages correctly', () => {
    const messages = [
      createMockMessage({ id: '1', type: 'success', message: 'Success message' }),
      createMockMessage({ id: '2', type: 'error', message: 'Error message' })
    ];

    render(<MessageSystem messages={messages} onRemoveMessage={mockOnRemoveMessage} />);

    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('renders nothing when no messages', () => {
    const { container } = render(<MessageSystem messages={[]} onRemoveMessage={mockOnRemoveMessage} />);
    expect(container.firstChild).toBeNull();
  });

  it('limits messages to maxMessages', () => {
    const messages = Array.from({ length: 10 }, (_, i) => 
      createMockMessage({ id: i.toString(), message: `Message ${i}` })
    );

    render(<MessageSystem messages={messages} onRemoveMessage={mockOnRemoveMessage} maxMessages={3} />);

    // Should only show the last 3 messages
    expect(screen.getByText('Message 7')).toBeInTheDocument();
    expect(screen.getByText('Message 8')).toBeInTheDocument();
    expect(screen.getByText('Message 9')).toBeInTheDocument();
    expect(screen.queryByText('Message 6')).not.toBeInTheDocument();
  });

  it('auto-removes success messages after 5 seconds', async () => {
    vi.useFakeTimers();

    const messages = [
      createMockMessage({ id: '1', type: 'success', message: 'Success message', autoRemove: true })
    ];

    render(<MessageSystem messages={messages} onRemoveMessage={mockOnRemoveMessage} />);

    expect(screen.getByText('Success message')).toBeInTheDocument();

    // Fast-forward 5 seconds
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockOnRemoveMessage).toHaveBeenCalledWith('1');
    }, { timeout: 100 });

    vi.useRealTimers();
  });

  it('does not auto-remove non-success messages', async () => {
    vi.useFakeTimers();

    const messages = [
      createMockMessage({ id: '1', type: 'error', message: 'Error message', autoRemove: true })
    ];

    render(<MessageSystem messages={messages} onRemoveMessage={mockOnRemoveMessage} />);

    // Fast-forward 5 seconds
    vi.advanceTimersByTime(5000);

    expect(mockOnRemoveMessage).not.toHaveBeenCalled();
  });

  it('does not auto-remove messages without autoRemove flag', async () => {
    vi.useFakeTimers();

    const messages = [
      createMockMessage({ id: '1', type: 'success', message: 'Success message', autoRemove: false })
    ];

    render(<MessageSystem messages={messages} onRemoveMessage={mockOnRemoveMessage} />);

    // Fast-forward 5 seconds
    vi.advanceTimersByTime(5000);

    expect(mockOnRemoveMessage).not.toHaveBeenCalled();
  });

  it('handles dismiss button click', () => {
    const messages = [
      createMockMessage({ id: '1', message: 'Test message' })
    ];

    render(<MessageSystem messages={messages} onRemoveMessage={mockOnRemoveMessage} />);

    const dismissButton = screen.getByLabelText('Dismiss message');
    fireEvent.click(dismissButton);

    expect(mockOnRemoveMessage).toHaveBeenCalledWith('1');
  });

  it('applies custom className', () => {
    const messages = [createMockMessage()];
    render(<MessageSystem messages={messages} onRemoveMessage={mockOnRemoveMessage} className="custom-class" />);

    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });
});

describe('MessageCard', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders success message with correct styling', () => {
    const message = createMockMessage({ type: 'success', message: 'Success message' });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    const messageContainer = document.querySelector('.bg-green-50');
    expect(messageContainer).toBeInTheDocument();
  });

  it('renders error message with correct styling', () => {
    const message = createMockMessage({ type: 'error', message: 'Error message' });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    const messageContainer = document.querySelector('.bg-red-50');
    expect(messageContainer).toBeInTheDocument();
  });

  it('renders warning message with correct styling', () => {
    const message = createMockMessage({ type: 'warning', message: 'Warning message' });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    const messageContainer = document.querySelector('.bg-yellow-50');
    expect(messageContainer).toBeInTheDocument();
  });

  it('renders info message with correct styling', () => {
    const message = createMockMessage({ type: 'info', message: 'Info message' });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    const messageContainer = document.querySelector('.bg-blue-50');
    expect(messageContainer).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    const message = createMockMessage({ 
      title: 'Message Title', 
      message: 'Message content' 
    });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    expect(screen.getByText('Message Title')).toBeInTheDocument();
    expect(screen.getByText('Message content')).toBeInTheDocument();
  });

  it('renders details in collapsible section', () => {
    const message = createMockMessage({ 
      message: 'Message content',
      details: 'Detailed error information'
    });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    expect(screen.getByText('Show details')).toBeInTheDocument();
    
    // Click to expand details
    fireEvent.click(screen.getByText('Show details'));
    expect(screen.getByText('Detailed error information')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    const mockAction = vi.fn();
    const message = createMockMessage({ 
      message: 'Message content',
      actions: [
        { label: 'Retry', onClick: mockAction, variant: 'primary' },
        { label: 'Cancel', onClick: mockAction, variant: 'secondary' }
      ]
    });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    const retryButton = screen.getByText('Retry');
    const cancelButton = screen.getByText('Cancel');
    
    expect(retryButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockAction).toHaveBeenCalled();
  });

  it('displays timestamp', () => {
    const message = createMockMessage({ 
      timestamp: new Date('2023-01-01T12:30:45Z')
    });
    render(<MessageSystem messages={[message]} onRemoveMessage={mockOnDismiss} />);

    // Should display formatted time
    expect(screen.getByText(/12:30:45/)).toBeInTheDocument();
  });

  it('renders correct icons for each message type', () => {
    const messages = [
      createMockMessage({ id: '1', type: 'success' }),
      createMockMessage({ id: '2', type: 'error' }),
      createMockMessage({ id: '3', type: 'warning' }),
      createMockMessage({ id: '4', type: 'info' })
    ];

    render(<MessageSystem messages={messages} onRemoveMessage={mockOnDismiss} />);

    // Check that each message has an icon (SVG element)
    const icons = document.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(4); // At least 4 icons (one per message type)
  });
});

describe('useMessageSystem hook', () => {
  const TestComponent: React.FC = () => {
    const { messages, addMessage, removeMessage, clearMessages, updateMessage } = useMessageSystem();

    return (
      <div>
        <button onClick={() => addMessage('info', 'Test message')}>Add Message</button>
        <button onClick={() => addMessage('success', 'Success message', { autoRemove: true })}>Add Auto-Remove</button>
        <button onClick={() => removeMessage(messages[0]?.id || '')}>Remove First</button>
        <button onClick={clearMessages}>Clear All</button>
        <button onClick={() => updateMessage(messages[0]?.id || '', { message: 'Updated message' })}>Update First</button>
        <div data-testid="message-count">{messages.length}</div>
        {messages.map(msg => (
          <div key={msg.id} data-testid={`message-${msg.id}`}>{msg.message}</div>
        ))}
      </div>
    );
  };

  it('adds messages correctly', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Add Message'));
    
    expect(screen.getByTestId('message-count')).toHaveTextContent('1');
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('adds messages with options', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Add Auto-Remove'));
    
    expect(screen.getByTestId('message-count')).toHaveTextContent('1');
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('removes messages correctly', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Add Message'));
    expect(screen.getByTestId('message-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('Remove First'));
    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
  });

  it('clears all messages', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Add Message'));
    fireEvent.click(screen.getByText('Add Message'));
    expect(screen.getByTestId('message-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('Clear All'));
    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
  });

  it('updates messages correctly', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Add Message'));
    expect(screen.getByText('Test message')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Update First'));
    expect(screen.getByText('Updated message')).toBeInTheDocument();
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });

  it('generates unique message IDs', () => {
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Add Message'));
    fireEvent.click(screen.getByText('Add Message'));

    const messageElements = screen.getAllByTestId(/message-/);
    expect(messageElements.length).toBeGreaterThanOrEqual(2);
    
    // IDs should be different
    const ids = messageElements.map(el => el.getAttribute('data-testid'));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
  });
});