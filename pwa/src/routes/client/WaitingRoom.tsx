import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { useSessionStore } from '@/store/useSessionStore';
import { useChatStore } from '@/store/useChatStore';
import { getSession, abandonSession, getMarketingCards, sendHeartbeat } from '@/lib/api/client';
import { Button } from '@/components/shared/Button';
import { MarketingCard } from '@/components/shared/MarketingCard';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { unlockAudio, playNotificationSound } from '@/lib/audioManager';

export const WaitingRoom: React.FC = () => {
  const navigate = useNavigate();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isCalled, setIsCalled] = useState(false);
  const navigatingRef = useRef(false);

  const {
    sessionId, ticketCode, position, estimatedWaitMinutes,
    marketingCards, storeId, storeName, assignedDesk, aiConversationId,
    setMarketingCards, updateQueuePosition, setStatus, clearSession, setAssignedDesk
  } = useSessionStore();

  const { conversationId, setConversationId, reset: resetChat } = useChatStore();

  // Restore conversation on refresh if session store has a persisted conversation id
  useEffect(() => {
    if (aiConversationId && !conversationId) {
      setConversationId(aiConversationId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle audio enable button click
  const handleEnableAudio = async () => {
    const success = await unlockAudio();
    if (success) {
      setAudioEnabled(true);
      // Play a short confirmation sound
      await playNotificationSound();
    }
  };

  // Poll session status from real API
  const pollSessionStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await getSession(sessionId);
      if (response.success && response.data) {
        const data = response.data;

        // Update position and wait time from API
        if (data.position !== undefined) {
          updateQueuePosition(data.position, data.estimated_wait_minutes || data.position * 5);
        }

        // Check if called or serving — delay navigation so ChatPanel can show handover message
        if ((data.status === 'called' || data.status === 'serving') && !navigatingRef.current) {
          navigatingRef.current = true;
          setAssignedDesk(data.service_point_name || 'Cassa A');
          setStatus('called');
          setIsCalled(true);
          setTimeout(() => navigate('/your-turn'), 6000);
        } else if (data.status === 'finished' || data.status === 'abandoned' || data.status === 'missed') {
          // Session ended (completed, user left, or missed their turn)
          clearSession();
          // Set flag to prevent auto-rejoin when landing page loads with entry point in URL
          sessionStorage.setItem('kyros_just_left', 'true');
          navigate('/');
        }
      }
    } catch (e) {
      console.error('Failed to poll session:', e);
    }
  }, [sessionId, updateQueuePosition, setAssignedDesk, setStatus, clearSession, navigate]);

  // Heartbeat to keep session alive
  useEffect(() => {
    if (!sessionId) return;
    
    // Initial heartbeat
    sendHeartbeat(sessionId).catch(e => console.error('Heartbeat error:', e));
    
    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat(sessionId).catch(e => console.error('Heartbeat error:', e));
    }, 30000);
    
    return () => clearInterval(heartbeatInterval);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    // Load marketing cards from real API
    if (storeId && marketingCards.length === 0) {
      getMarketingCards(storeId).then(response => {
        if (response.success && response.data?.cards) {
          setMarketingCards(response.data.cards);
        }
      }).catch(e => console.error('Failed to load cards:', e));
    }

    // Poll session status every 3 seconds
    pollSessionStatus(); // Initial poll
    const interval = setInterval(pollSessionStatus, 3000);

    return () => clearInterval(interval);
  }, [sessionId, storeId, marketingCards.length, pollSessionStatus, navigate, setMarketingCards]);

  const handleLeaveQueue = async () => {
    if (window.confirm("Are you sure you want to leave the queue? You will lose your spot.")) {
      if (sessionId) {
        try {
          await abandonSession(sessionId);
        } catch (e) {
          console.error('Failed to abandon session:', e);
        }
      }
      resetChat();
      clearSession();
      sessionStorage.setItem('kyros_just_left', 'true');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <span className="text-xs font-bold text-slate-500 tracking-wider">YOUR TICKET</span>
        <button onClick={handleLeaveQueue} className="text-xs text-slate-500 hover:text-red-400">
          Leave Queue ✕
        </button>
      </div>

      {/* Store Name & Ticket Status */}
      <div className="px-6 py-5 text-center">
        {/* Store Name */}
        {storeName && (
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
            {storeName}
          </p>
        )}

        {/* Compact Ticket Display */}
        <div className="inline-flex items-center gap-3 border border-teal-500/30 rounded-xl px-5 py-3 bg-teal-500/5 mb-4">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
          <span className="text-2xl font-bold text-teal-400 tracking-wider font-mono">
            {ticketCode}
          </span>
        </div>

        {/* Queue Position */}
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="text-slate-300">
            Position <strong className="text-teal-400 text-lg">{position ?? '...'}</strong>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">
            ~{estimatedWaitMinutes ?? '...'} min wait
          </span>
        </div>
      </div>

      {/* Audio Alert Button */}
      <div className="px-6 mt-6">
        <button
          onClick={handleEnableAudio}
          disabled={audioEnabled}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
            audioEnabled
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-teal-500/30 hover:text-teal-400 active:scale-[0.98]'
          }`}
        >
          {audioEnabled ? (
            <>
              <BellRing size={18} />
              Audio Alert Enabled
            </>
          ) : (
            <>
              <Bell size={18} />
              Enable Audio Alert
            </>
          )}
        </button>
      </div>

      {/* Content Feed */}
      <div className="px-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 mt-8">While you wait</h3>
        
        {marketingCards.length === 0 ? (
          // Skeleton Loader
          [1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-white/5 h-48 animate-pulse"></div>
          ))
        ) : (
          marketingCards.map(card => (
            <MarketingCard key={card.id} {...card} />
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <Button variant="ghost" onClick={handleLeaveQueue}>
            LEAVE QUEUE
          </Button>
        </div>
      </div>

      {/* AI Concierge Chat */}
      {sessionId && (
        <ChatPanel
          sessionId={sessionId}
          isCalled={isCalled}
          assignedDesk={assignedDesk}
        />
      )}
    </div>
  );
};