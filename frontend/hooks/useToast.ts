import { createContext, useContext } from 'react';

export type ToastType = 'win' | 'loss' | 'info' | 'error';

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
