import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, Copy, Check, QrCode, Wifi, Smartphone
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import toast from 'react-hot-toast';

/**
 * @component ShareQrModal
 * @description Sleek modal mounted via React Portal to guarantee viewport-relative centering.
 */
const ShareQrModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Determine current LAN origin or fallback
  const shareUrl = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'http://10.95.148.101:5173';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Mount directly to document.body so sticky/backdrop-blur in Navbar does not clip the modal
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative z-10 w-full max-w-sm rounded-3xl shadow-2xl border p-6 flex flex-col items-center text-center ${
              isDark
                ? 'bg-[#0f172a] border-white/10 text-white shadow-2xl shadow-indigo-950/60'
                : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
            }`}
          >
            {/* Top Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Close modal"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            {/* Header Icon */}
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3 shrink-0">
              <QrCode size={22} className="text-white" />
            </div>

            <h3 className="text-lg font-bold tracking-tight mb-1 text-white">
              Scan & Join QuizMaster AI
            </h3>
            <p className="text-xs text-slate-400 mb-4 max-w-xs">
              Scan with your phone camera to join and battle live!
            </p>

            {/* QR Code Container (High-contrast crisp white canvas) */}
            <div className="p-3.5 rounded-2xl bg-white shadow-lg ring-4 ring-indigo-500/20 mb-4 flex items-center justify-center">
              <QRCodeSVG
                value={shareUrl}
                size={180}
                level="H"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>

            {/* URL Display & Copy Button */}
            <div className={`w-full flex items-center justify-between p-2 rounded-xl border mb-3 text-xs ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <span className="font-mono truncate px-2 text-indigo-400 font-semibold select-all">
                {shareUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Copy URL"
              >
                {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Help Info Box */}
            <div className="w-full space-y-1.5 text-left">
              <div className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] ${
                isDark ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
              }`}>
                <Smartphone size={14} className="text-indigo-400 shrink-0" />
                <span>Open your phone camera & point at the screen</span>
              </div>

              <div className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] ${
                isDark ? 'bg-cyan-950/30 border-cyan-500/20 text-cyan-200' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
              }`}>
                <Wifi size={14} className="text-cyan-400 shrink-0" />
                <span>Must be connected to the same Wi-Fi router</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ShareQrModal;
