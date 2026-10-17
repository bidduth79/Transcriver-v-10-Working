import { useCallback } from 'react';
import { toast } from 'sonner';

export const useToast = (appLang: string) => {
  const addToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning', options?: { duration?: number; id?: string | number }) => {
    // Schedule via macrotask so sonner's internal flushSync never runs during React lifecycle rendering
    setTimeout(() => {
      switch (type) {
        case 'success':
          toast.success(msg, options);
          break;
        case 'error':
          toast.error(msg, options);
          break;
        case 'warning':
          toast.warning(msg, options);
          break;
        case 'info':
        default:
          toast.info(msg, options);
          break;
      }
    }, 0);
  }, []);

  const dismissToast = useCallback((id?: string | number) => {
    toast.dismiss(id);
  }, []);

  return { addToast, dismissToast };
};
