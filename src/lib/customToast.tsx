import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { ModernTopToast, ToastVariant } from '../components/ModernTopToast';

interface ToastOptions {
  description?: string | React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function showModernToast(
  title: string | React.ReactNode,
  variant: ToastVariant = 'default',
  options?: ToastOptions
) {
  const duration = options?.duration || 4500;

  return sonnerToast.custom(
    (id) => (
      <ModernTopToast
        id={id}
        title={title}
        description={options?.description}
        variant={variant}
        icon={options?.icon}
        badge={options?.badge}
        action={options?.action}
        duration={duration}
      />
    ),
    { duration }
  );
}

export const showToast = {
  success: (title: string | React.ReactNode, options?: ToastOptions) =>
    showModernToast(title, 'success', options),
  error: (title: string | React.ReactNode, options?: ToastOptions) =>
    showModernToast(title, 'error', options),
  warning: (title: string | React.ReactNode, options?: ToastOptions) =>
    showModernToast(title, 'warning', options),
  info: (title: string | React.ReactNode, options?: ToastOptions) =>
    showModernToast(title, 'info', options),
  achievement: (title: string | React.ReactNode, options?: ToastOptions) =>
    showModernToast(title, 'achievement', options),
  custom: sonnerToast.custom,
  dismiss: sonnerToast.dismiss,
};

// Also export as default and unified toast object
export default showToast;
