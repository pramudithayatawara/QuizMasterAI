import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, Copy, Check, QrCode, Wifi, Smartphone,
  ExternalLink, Sparkles
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import toast from 'react-hot-toast';

/**
 * @component ShareQrModal
 * @description Sleek interactive modal displaying dynamic network QR code for peer/mobile sharing.
 */
const ShareQrModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Determine current LAN origin or fallback
  const shareUrl = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'http://10.95.148.101:5173';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Network link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border p-6 flex flex-col items-center text-center ${
            isDark
              ? 'bg-[#0c1220] border-white/10 text-white shadow-indigo-950/40'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60'
          }`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>

          {/* Header Icon & Title */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3.5">
            <QrCode size={24} className="text-white" />
          </div>

          <h3 className="text-xl font-extrabold tracking-tight mb-1">
            Scan & Join QuizMaster AI
          </h3>
          <p className="text-xs text-slate-400 mb-5 max-w-xs">
            Open on your phone or share instantly with friends on the same Wi-Fi router.
          </p>

          {/* QR Code Container (High contrast white card for reliable phone camera scan) */}
          <div className="p-4 rounded-2xl bg-white shadow-xl ring-4 ring-indigo-500/20 mb-5 flex items-center justify-center">
            <QRCodeSVG
              value={shareUrl}
              size={210}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>

          {/* URL Box & Copy */}
          <div className={`w-full flex items-center justify-between p-2.5 rounded-xl border mb-4 text-xs ${
            isDark ? 'bg-slate-900/80 border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            <span className="font-mono truncate px-2 text-indigo-400 font-semibold">
              {shareUrl}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 transition-all cursor-pointer shadow-sm"
              title="Copy URL"
            >
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Helpful Tips */}
          <div className="w-full space-y-2 text-left">
            <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
              isDark ? 'bg-indigo-950/30 border-indigo-500/20 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
            }`}>
              <Smartphone size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <span>Point your Phone Camera or any QR scanner app at the screen to open directly.</span>
            </div>

            <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
              isDark ? 'bg-cyan-950/20 border-cyan-500/20 text-cyan-200' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
            }`}>
              <Wifi size={16} className="text-cyan-400 shrink-0 mt-0.5" />
              <span>Ensure your phone is connected to the same Wi-Fi router network.</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShareQrModal;
