import React, { useCallback, useEffect } from 'react';

export interface Message {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  details?: string;
  timestamp: Date;
  autoRemove?: boolean;
  actions?: MessageAction[];
}

export interface MessageAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface MessageSystemProps {
  messages: Message[];
  onRemoveMessage: (id: string) => void;
  maxMessages?: number;
  className?: string;
}

export const MessageSystem: React.FC<MessageSystemProps> = ({
  messages,
  onRemoveMessage,
  maxMessages = 5,
  className = ''
}) => {
  // Auto-remove messages with autoRemove flag after 5 seconds
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    messages.forEach(message => {
      if (message.autoRemove && message.type === 'success') {
        const timer = setTimeout(() => {
          onRemoveMessage(message.id);
        }, 5000);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [messages, onRemoveMessage]);

  const handleDismiss = useCallback((messageId: string) => {
    onRemoveMessage(messageId);
  }, [onRemoveMessage]);

  // Show only the most recent messages
  const visibleMessages = messages.slice(-maxMessages);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`} role="alert" aria-live="polite">
      {visibleMessages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
};

interface MessageCardProps {
  message: Message;
  onDismiss: (id: string) => void;
}

const MessageCard: React.FC<MessageCardProps> = ({ message, onDismiss }) => {
  const getMessageStyles = () => {
    switch (message.type) {
      case 'success':
        return {
          container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          icon: 'text-green-400',
          title: 'text-green-800 dark:text-green-200',
          text: 'text-green-700 dark:text-green-300',
          button: 'text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300'
        };
      case 'error':
        return {
          container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
          icon: 'text-red-400',
          title: 'text-red-800 dark:text-red-200',
          text: 'text-red-700 dark:text-red-300',
          button: 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-400',
          title: 'text-yellow-800 dark:text-yellow-200',
          text: 'text-yellow-700 dark:text-yellow-300',
          button: 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300'
        };
      case 'info':
      default:
        return {
          container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          icon: 'text-blue-400',
          title: 'text-blue-800 dark:text-blue-200',
          text: 'text-blue-700 dark:text-blue-300',
          button: 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
        };
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const styles = getMessageStyles();

  return (
    <div className={`p-4 border rounded-lg shadow-sm ${styles.container}`}>
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          {getIcon()}
        </div>
        
        <div className="ml-3 flex-1">
          {message.title && (
            <h4 className={`text-sm font-medium ${styles.title}`}>
              {message.title}
            </h4>
          )}
          
          <div className={`text-sm ${message.title ? 'mt-1' : ''} ${styles.text}`}>
            {message.message}
          </div>
          
          {message.details && (
            <details className="mt-2">
              <summary className={`text-xs cursor-pointer ${styles.button}`}>
                Show details
              </summary>
              <div className={`mt-2 text-xs ${styles.text} font-mono bg-black/5 dark:bg-white/5 p-2 rounded`}>
                {message.details}
              </div>
            </details>
          )}
          
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 flex space-x-2">
              {message.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`text-xs font-medium px-3 py-1 rounded ${
                    action.variant === 'primary'
                      ? `bg-current text-white ${styles.button}`
                      : `${styles.button} hover:underline`
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          
          <div className={`text-xs ${styles.text} opacity-75 mt-2`}>
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
        
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={() => onDismiss(message.id)}
            className={`inline-flex rounded-md p-1.5 ${styles.button} hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current`}
            aria-label="Dismiss message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for managing messages
 */
export const useMessageSystem = () => {
  const [messages, setMessages] = React.useState<Message[]>([]);

  const addMessage = useCallback((
    type: Message['type'],
    message: string,
    options?: {
      title?: string;
      details?: string;
      autoRemove?: boolean;
      actions?: MessageAction[];
    }
  ) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      autoRemove: options?.autoRemove ?? (type === 'success'),
      ...options
    };

    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  return {
    messages,
    addMessage,
    removeMessage,
    clearMessages,
    updateMessage
  };
};