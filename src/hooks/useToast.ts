import { useState, useCallback } from 'react';
import type { Toast, ToastType } from '../types/toast';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, type, message, duration };
    
    setToasts(prev => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((message: string, duration?: number) => 
    addToast('success', message, duration), [addToast]);
  
  const error = useCallback((message: string, duration?: number) => 
    addToast('error', message, duration), [addToast]);
  
  const warning = useCallback((message: string, duration?: number) => 
    addToast('warning', message, duration), [addToast]);
  
  const info = useCallback((message: string, duration?: number) => 
    addToast('info', message, duration), [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
  };
}