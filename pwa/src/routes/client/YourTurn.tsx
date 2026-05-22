import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Volume2 } from 'lucide-react';
import { useSessionStore } from '@/store/useSessionStore';
import { getSession } from '@/lib/api/client';
import { playAlert, playNotificationSound, triggerVibration, isAudioReady } from '@/lib/audioManager';

export const YourTurn: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId, ticketCode, assignedDesk, setStatus, clearSession } = useSessionStore();
  const hasPlayedAlert = useRef(false);
  const [soundFailed, setSoundFailed] = useState(false);

  // Poll session status to detect when admin marks as served
  const pollSessionStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await getSession(sessionId);
      if (response.success && response.data) {
        const serverStatus = response.data.status;

        // If finished or serving, go to thank you
        if (serverStatus === 'finished' || serverStatus === 'serving') {
          setStatus('finished');
          navigate('/thank-you');
        } else if (serverStatus === 'abandoned' || serverStatus === 'missed') {
          // Session was cancelled
          clearSession();
          navigate('/');
        }
      }
    } catch (e) {
      console.error('Failed to poll session:', e);
    }
  }, [sessionId, setStatus, clearSession, navigate]);

  // Play sound and vibrate on mount with retry mechanism
  useEffect(() => {
    if (!hasPlayedAlert.current) {
      hasPlayedAlert.current = true;

      const attemptAlert = async () => {
        // First attempt with multiple retries
        const success = await playAlert(3);

        if (!success) {
          setSoundFailed(true);
        }

        // Repeat alert after 2 seconds for extra attention
        setTimeout(async () => {
          await playAlert(2);
        }, 2000);
      };

      attemptAlert();
    }
  }, []);

  // Poll session status
  useEffect(() => {
    const interval = setInterval(pollSessionStatus, 3000);
    return () => clearInterval(interval);
  }, [pollSessionStatus]);

  // Manual trigger for sound/vibration
  const handleManualAlert = async () => {
    await playAlert(1);
    setSoundFailed(false);
  };

  return (
    <div className="min-h-screen bg-teal-400 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">

      {/* Background Pulse Animation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 bg-slate-900/10 rounded-full animate-wave"></div>
        <div className="w-80 h-80 bg-slate-900/10 rounded-full animate-wave [animation-delay:0.5s] absolute"></div>
        <div className="w-80 h-80 bg-slate-900/10 rounded-full animate-wave [animation-delay:1s] absolute"></div>
      </div>

      {/* Main Card */}
      <div className="relative z-10 bg-slate-900 p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-700/50">

        {/* Icon */}
        <div className="w-20 h-20 bg-teal-400 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-900 shadow-lg shadow-teal-400/30 animate-bounce">
          <Bell size={40} fill="currentColor" />
        </div>

        <h1 className="text-4xl font-serif font-bold text-slate-50 mb-2">It's Your Turn</h1>
        <p className="text-slate-400 mb-3 font-medium">Please proceed immediately.</p>
        <p className="text-slate-500 text-sm mb-8">Your chat has been shared with our assistant — they'll greet you personally.</p>

        {/* Counter Assignment */}
        <div className="bg-slate-800 rounded-2xl p-6 mb-4 border-2 border-teal-400/50 shadow-[0_0_20px_rgba(47,93,80,0.2)] overflow-hidden">
          <span className="block text-xs text-slate-400 uppercase tracking-widest mb-1">Your Counter is</span>
          <span className="block text-2xl sm:text-3xl font-serif font-bold text-teal-400 truncate">
            {assignedDesk || 'Cassa A'}
          </span>
        </div>

        {/* Ticket Info */}
        <div className="inline-block px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700 mb-4">
           <span className="text-slate-500 text-sm">Ticket: <strong className="text-slate-300">{ticketCode}</strong></span>
        </div>

        {/* Subtle fallback button - only prominent if sound failed */}
        <button
          onClick={handleManualAlert}
          className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-all text-xs ${
            soundFailed
              ? 'bg-teal-400/20 text-teal-400 border border-teal-400/30 py-3'
              : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <Volume2 size={14} />
          {soundFailed ? 'Tap to enable sound' : 'Tap to repeat alert'}
        </button>

      </div>
    </div>
  );
};
