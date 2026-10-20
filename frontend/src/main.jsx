import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { X } from 'lucide-react';
import App from './App.jsx';
import { ToastLimitManager } from './utils/toastConfig.js';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      {/* Toast Manager: Deduplicates identical toasts and limits max visible count to 2 */}
      <ToastLimitManager maxVisible={2} />
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#0e1526',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            padding: '10px 14px',
            fontSize: '13.5px',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#0e1526',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#0e1526',
            },
          },
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <div
                className="flex items-center gap-2.5 w-full cursor-pointer select-none"
                onClick={() => toast.dismiss(t.id)}
                title="Click to dismiss"
              >
                {icon}
                <div className="flex-1 text-sm font-medium leading-snug break-words">
                  {message}
                </div>
                {t.type !== 'loading' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.dismiss(t.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer flex-shrink-0"
                    title="Close notification"
                    aria-label="Close notification"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        )}
      </Toaster>
    </BrowserRouter>
  </React.StrictMode>
);