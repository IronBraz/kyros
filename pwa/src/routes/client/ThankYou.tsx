import React, { useEffect, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { useSessionStore } from '@/store/useSessionStore';

const AUTO_CLOSE_SECONDS = 7;

export const ThankYou: React.FC = () => {
  const { storeName, clearSession } = useSessionStore();
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);

  useEffect(() => {
    // Clear session and set flag to prevent auto-rejoin
    clearSession();
    sessionStorage.setItem('kyros_just_left', 'true');
  }, [clearSession]);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Clear page immediately and try to close
          document.body.innerHTML = '';
          document.body.style.backgroundColor = '#000';
          // Navigate to about:blank first (works reliably across browsers)
          window.location.href = 'about:blank';
          // Then attempt window.close() (may work on some browsers/PWAs)
          try {
            window.close();
          } catch (e) {
            // Ignore - about:blank is already showing
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center animate-[fade-in_1s_ease-out] bg-slate-900">
      {/* Animated Thumbs Up Icon */}
      <div className="relative mb-8">
        {/* Glow effect background */}
        <div className="absolute inset-0 bg-teal-400/20 rounded-full blur-xl animate-pulse"></div>

        {/* Icon container with pulse animation */}
        <div className="relative w-24 h-24 bg-gradient-to-br from-teal-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-400/30 animate-[pulse_2s_ease-in-out_infinite]">
          <ThumbsUp size={48} className="text-slate-900" strokeWidth={2.5} />
        </div>
      </div>

      <h1 className="text-4xl font-serif font-bold text-slate-50 mb-3">Thank You!</h1>
      <p className="text-slate-400 max-w-xs mx-auto leading-relaxed text-lg">
        We hope you had a great experience{storeName ? ` at ${storeName}` : ''}.
      </p>

      {/* Subtle divider */}
      <div className="w-16 h-0.5 bg-teal-400/30 rounded-full my-8"></div>

      <p className="text-slate-500 text-sm mb-2">
        See you next time!
      </p>

      <div className="mt-8">
        <p className="text-xs text-slate-600">
          Closing in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
};
