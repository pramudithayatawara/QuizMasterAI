import React, { useEffect } from 'react';
import toast, { useToasterStore } from 'react-hot-toast';

/**
 * @utils toastConfig
 * @description Global deduplication and toast stacking manager.
 * Prevents identical notifications from spamming, limits maximum active toasts,
 * and enables manual dismiss functionality on all toasts.
 */

// Generate deterministic ID from message text to update in-place instead of creating duplicates
const getDeduplicationId = (message, opts) => {
  if (opts && opts.id) return opts.id;
  if (!message) return undefined;
  
  if (typeof message === 'string' || typeof message === 'number') {
    const clean = String(message).trim().toLowerCase().slice(0, 100);
    return `toast_${clean}`;
  }
  return undefined;
};

// Global patch on react-hot-toast singleton
if (typeof window !== 'undefined' && !window.__toast_deduped_patched__) {
  window.__toast_deduped_patched__ = true;

  const originalSuccess = toast.success;
  const originalError = toast.error;
  const originalLoading = toast.loading;

  toast.success = (message, opts = {}) => {
    const id = getDeduplicationId(message, opts);
    return originalSuccess(message, id ? { id, ...opts } : opts);
  };

  toast.error = (message, opts = {}) => {
    const id = getDeduplicationId(message, opts);
    return originalError(message, id ? { id, ...opts } : opts);
  };

  toast.loading = (message, opts = {}) => {
    const id = getDeduplicationId(message, opts);
    return originalLoading(message, id ? { id, ...opts } : opts);
  };
}

/**
 * @component ToastLimitManager
 * @description Ensures only maxVisible toasts are shown simultaneously,
 * immediately dismissing any duplicates so notifications stack cleanly in the exact same spot.
 */
export const ToastLimitManager = ({ maxVisible = 2 }) => {
  const { toasts } = useToasterStore();

  useEffect(() => {
    // 1. Deduplicate visible toasts
    const seenMessages = new Set();
    const visibleToasts = toasts.filter((t) => t.visible);

    visibleToasts.forEach((t) => {
      let msg = '';
      if (typeof t.message === 'string') {
        msg = t.message.trim();
      } else if (typeof t.message === 'function') {
        try {
          msg = String(t.message(t)).trim();
        } catch {
          msg = '';
        }
      }

      if (msg) {
        if (seenMessages.has(msg)) {
          // Duplicate found: dismiss immediately
          toast.dismiss(t.id);
        } else {
          seenMessages.add(msg);
        }
      }
    });

    // 2. Limit maximum visible toasts (so new toast replaces or neatly caps the stack)
    visibleToasts
      .filter((_, i) => i >= maxVisible)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts, maxVisible]);

  return null;
};
