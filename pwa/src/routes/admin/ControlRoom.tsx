import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer, StoreSettings, ViewMode, EntryPoint, MarketingCard, QueueStats } from '@/types/admin';
import { Layout } from './Layout';
import { CounterMode } from './modes/CounterMode';
import { AnalyticsMode } from './modes/AnalyticsMode';
import { ZonesMode } from './modes/ZonesMode';
import { ContentMode } from './modes/ContentMode';
import { SettingsMode } from './modes/SettingsMode';
import {
  getEntryPoints, createEntryPoint, deleteEntryPoint,
  updateStoreSettings, getStoreSettings,
  getQueueStatus, callNextCustomer,
  getMarketingCards, createMarketingCard, updateMarketingCard, deleteMarketingCard,
  updateSessionStatus, MarketingCardData
} from '@/lib/api/admin';

// Initial state constants
const INITIAL_STATS: QueueStats = {
  waitingCount: 0,
  calledCount: 0,
  avgWaitMinutes: 0,
  totalCustomers: 0,
  abandonmentRate: 0,
  servedCount: 0,
  missedCount: 0,
};

const INITIAL_SETTINGS: StoreSettings = {
  acceptingTickets: true,
  closedMessage: "We're not accepting new customers at the moment. Please speak to our staff.",
  avgServiceTime: 5,
  ghostTimeout: 15,
  calledTimeout: 5,
  welcomeMessage: "Welcome to Kyros Store",
  callSound: "ding-dong",
  language: "it",
};

interface ControlRoomProps {
  mode: ViewMode;
}

export const ControlRoom: React.FC<ControlRoomProps> = ({ mode }) => {
  const navigate = useNavigate();

  // Get storeId and storeName from localStorage (already authenticated)
  const [storeId, setStoreId] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('');

  // Refs for preventing concurrent fetches / double-clicks
  const isLoadingQueueRef = useRef(false);
  const isCallingRef = useRef(false);

  // App State
  const [currentView, setCurrentView] = useState<ViewMode>(mode);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [servedHistory, setServedHistory] = useState<Customer[]>([]);
  const [isCalling, setIsCalling] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [marketingCards, setMarketingCards] = useState<MarketingCard[]>([]);

  // Load storeId and storeName from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('kyros_admin_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setStoreId(session.store_id);
        setStoreName(session.store_name);
      } catch (e) {
        console.error('Failed to load admin session:', e);
      }
    }
  }, []);

  // Sync currentView with mode prop from routing
  useEffect(() => {
    setCurrentView(mode);
  }, [mode]);

  // Load entry points, settings, queue, and marketing cards when storeId is available
  useEffect(() => {
    if (storeId) {
      loadEntryPoints();
      loadSettings();
      loadQueueStatus();
      loadMarketingCards();
    }
  }, [storeId]);

  // Adaptive polling: 2s when a customer is called (watching for AI summary), 5s otherwise
  const hasCalled = customers.some(c => c.status === 'called');
  useEffect(() => {
    if (!storeId) return;
    const interval = setInterval(loadQueueStatus, hasCalled ? 2000 : 5000);
    return () => clearInterval(interval);
  }, [storeId, hasCalled]);

  const loadEntryPoints = async () => {
    try {
      const response = await getEntryPoints(storeId);
      if (response.success && response.data) {
        const eps = response.data.entry_points;
        setEntryPoints(Array.isArray(eps) ? eps.map(ep => ({
          id: ep.id,
          name: ep.name,
          slug: ep.slug,
          url: ep.url
        })) : []);
      }
    } catch (e) {
      console.error('Failed to load entry points:', e);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await getStoreSettings(storeId);
      if (response.success && response.data?.settings) {
        const dbSettings = response.data.settings;
        // Transform DB format (snake_case, nested) to frontend format (camelCase, flat)
        setSettings({
          acceptingTickets: dbSettings.queue?.accepting_tickets ?? true,
          closedMessage: dbSettings.queue?.closed_message ?? 'We are currently closed. Please come back later.',
          avgServiceTime: dbSettings.queue?.avg_service_time_minutes ?? 5,
          ghostTimeout: dbSettings.queue?.ghost_timeout_minutes ?? 15,
          calledTimeout: dbSettings.queue?.called_timeout_minutes ?? 5,
          welcomeMessage: dbSettings.display?.welcome_message ?? 'Welcome! You are in the queue.',
          language: dbSettings.display?.language ?? 'it',
          callSound: dbSettings.notifications?.call_sound ?? 'ding-dong'
        });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const loadQueueStatus = async () => {
    if (isLoadingQueueRef.current) return;
    isLoadingQueueRef.current = true;
    try {
      const response = await getQueueStatus(storeId);
      if (response.success && response.data) {
        const data = response.data;

        // Transform API sessions to Customer format
        const allCustomers: Customer[] = [];

        // Waiting customers
        (data.waiting || []).forEach((s: any) => {
          allCustomers.push({
            id: s.id,
            ticketCode: s.ticket_code,
            status: 'waiting',
            position: s.position,
            joinTime: s.created_at,
            entryPointName: s.entry_point_name
          });
        });

        // Called/serving customers
        (data.called || []).forEach((s: any) => {
          allCustomers.push({
            id: s.id,
            ticketCode: s.ticket_code,
            status: s.status === 'serving' ? 'served' : 'called',
            position: 0,
            joinTime: s.created_at || '',
            calledAt: s.called_at,
            entryPointName: s.entry_point_name,
            ai_summary: s.ai_summary,
          });
        });

        // Missed customers
        (data.missed || []).forEach((s: any) => {
          allCustomers.push({
            id: s.id,
            ticketCode: s.ticket_code,
            status: 'missed',
            position: 0,
            joinTime: '',
            calledAt: s.called_at,
            missedAt: s.called_at,
            entryPointName: s.entry_point_name
          });
        });

        setCustomers(allCustomers);

        // Update stats from real API data
        const waitingCount = data.counts?.waiting || 0;
        // Calculate estimated wait time: waiting customers * avg service time per customer
        // If API provides avg_wait_minutes, use that; otherwise calculate from settings
        const calculatedWait = data.avg_wait_minutes !== undefined
          ? data.avg_wait_minutes
          : waitingCount * (settings.avgServiceTime || 5);

        setStats(prev => ({
          ...prev,
          waitingCount,
          calledCount: data.counts?.called || 0,
          missedCount: data.counts?.missed || 0,
          servedCount: data.counts?.served || 0,
          avgWaitMinutes: calculatedWait
        }));
      }
    } catch (e) {
      console.error('Failed to load queue status:', e);
    } finally {
      isLoadingQueueRef.current = false;
    }
  };

  const loadMarketingCards = async () => {
    try {
      const response = await getMarketingCards(storeId);
      if (response.success && response.data) {
        const cards = response.data.cards || [];
        setMarketingCards(cards.map(card => ({
          id: card.id,
          type: card.type as MarketingCard['type'],
          title: card.title,
          content: card.content,
          icon: card.icon || 'Star',
          theme: (card.theme || 'blue') as MarketingCard['theme'],
          priority: card.priority || 0,
          isActive: card.isActive ?? true,
          actionUrl: undefined
        })));
      }
    } catch (e) {
      console.error('Failed to load marketing cards:', e);
    }
  };

  // Derived State
  const waitingCustomers = customers.filter(c => c.status === 'waiting').sort((a, b) => a.position - b.position);
  const calledCustomers = [
    ...customers.filter(c => c.status === 'called' || c.status === 'served'),
    ...servedHistory.filter(h => !customers.some(c => c.id === h.id))
  ].sort((a, b) => new Date(b.calledAt || '').getTime() - new Date(a.calledAt || '').getTime());
  const missedCustomers = customers.filter(c => c.status === 'missed').sort((a, b) => new Date(b.missedAt || '').getTime() - new Date(a.missedAt || '').getTime());

  // Actions
  const handleLogout = () => {
    localStorage.removeItem('kyros_admin_session');
    navigate('/control-room/login');
  };

  const callNext = useCallback(async () => {
    if (waitingCustomers.length === 0 || isCallingRef.current) return;
    isCallingRef.current = true;
    setIsCalling(true);
    isLoadingQueueRef.current = false; // allow the post-call refresh through
    try {
      const response = await callNextCustomer(storeId);
      if (response.success) {
        await loadQueueStatus();
      } else {
        console.error('Failed to call next:', response.error);
      }
    } catch (e) {
      console.error('Failed to call next:', e);
    } finally {
      isCallingRef.current = false;
      setIsCalling(false);
    }
  }, [waitingCustomers, storeId]);

  const handleDeleteZone = async (id: string) => {
    console.log('Deleting entry point:', id);
    try {
      const response = await deleteEntryPoint(id);
      console.log('Delete response:', response);
      if (response.success) {
        setEntryPoints(prev => prev.filter(ep => ep.id !== id));
      } else {
        console.error('Delete failed:', response.error);
        alert('Failed to delete entry point: ' + (response.error?.message || 'Unknown error'));
      }
    } catch (e) {
      console.error('Failed to delete entry point:', e);
      alert('Network error while deleting entry point');
    }
  };

  const handleCreateZone = async (name: string, slug: string) => {
    try {
      const response = await createEntryPoint(storeId, name, slug);
      if (response.success && response.data) {
        setEntryPoints(prev => [...prev, {
          id: response.data!.id,
          name: response.data!.name,
          slug: response.data!.slug,
          url: response.data!.url
        }]);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to create entry point:', e);
      return false;
    }
  };

  const handleUpdateSettings = async (newSettings: StoreSettings) => {
    // Transform frontend format (camelCase, flat) to database format (snake_case, nested under 'queue')
    const dbSettings = {
      queue: {
        accepting_tickets: newSettings.acceptingTickets,
        closed_message: newSettings.closedMessage,
        avg_service_time_minutes: newSettings.avgServiceTime,
        ghost_timeout_minutes: newSettings.ghostTimeout,
        called_timeout_minutes: newSettings.calledTimeout
      },
      display: {
        welcome_message: newSettings.welcomeMessage,
        language: newSettings.language
      },
      notifications: {
        call_sound: newSettings.callSound
      }
    };

    try {
      const response = await updateStoreSettings(storeId, dbSettings);
      if (response.success) {
        setSettings(newSettings);
        alert('Settings saved successfully!');
      } else {
        console.error('Failed to save settings:', response.error);
        alert('Failed to save settings: ' + (response.error?.message || 'Unknown error'));
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
      alert('Network error while saving settings');
    }
  };

  const handleCreateCard = async (card: Omit<MarketingCard, 'id' | 'isActive'>): Promise<boolean> => {
    console.log('handleCreateCard called with:', { storeId, card });
    try {
      const response = await createMarketingCard(storeId, card);
      console.log('createMarketingCard response:', response);
      if (response.success && response.data) {
        setMarketingCards(prev => [...prev, {
          id: response.data!.id,
          type: response.data!.type as MarketingCard['type'],
          title: response.data!.title,
          content: response.data!.content,
          icon: response.data!.icon || 'Star',
          theme: (response.data!.theme || 'blue') as MarketingCard['theme'],
          priority: response.data!.priority || 0,
          isActive: response.data!.isActive ?? true,
          actionUrl: undefined
        }]);
        return true;
      }
      const errorMsg = response.error?.message || JSON.stringify(response);
      console.error('Create card API error:', errorMsg);
      alert('Failed to create card: ' + errorMsg);
      return false;
    } catch (e: any) {
      console.error('Failed to create marketing card:', e);
      alert('Network error while creating card: ' + (e?.message || 'Unknown error'));
      return false;
    }
  };

  const handleUpdateCard = async (id: string, card: Partial<MarketingCard>): Promise<boolean> => {
    try {
      const response = await updateMarketingCard(id, card);
      if (response.success && response.data) {
        setMarketingCards(prev => prev.map(c => c.id === id ? {
          ...c,
          type: response.data!.type as MarketingCard['type'],
          title: response.data!.title,
          content: response.data!.content,
          icon: response.data!.icon || c.icon,
          theme: (response.data!.theme || c.theme) as MarketingCard['theme'],
          priority: response.data!.priority ?? c.priority,
          isActive: response.data!.isActive ?? c.isActive
        } : c));
        return true;
      }
      alert('Failed to update card: ' + (response.error?.message || 'Unknown error'));
      return false;
    } catch (e) {
      console.error('Failed to update marketing card:', e);
      alert('Network error while updating card');
      return false;
    }
  };

  const handleDeleteCard = async (id: string): Promise<boolean> => {
    try {
      const response = await deleteMarketingCard(id);
      if (response.success) {
        setMarketingCards(prev => prev.filter(c => c.id !== id));
        return true;
      }
      alert('Failed to delete card: ' + (response.error?.message || 'Unknown error'));
      return false;
    } catch (e) {
      console.error('Failed to delete marketing card:', e);
      alert('Network error while deleting card');
      return false;
    }
  };

  // Spacebar Listener for "Call Next"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView === 'counter' && e.code === 'Space') {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
          callNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, callNext]);

  // Navigate between admin routes
  const handleNavigate = (view: ViewMode) => {
    navigate(`/control-room/${view}`);
  };

  return (
    <Layout
      currentView={currentView}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      storeName={storeName}
      stats={stats}
      settings={settings}
    >
      {currentView === 'counter' && (
        <CounterMode
          waiting={waitingCustomers}
          called={calledCustomers}
          missed={missedCustomers}
          onCallNext={callNext}
          isCallingNext={isCalling}
          onRecall={(id) => {
            setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: 'waiting', position: 0 } : c));
          }}
          onMarkServed={async (id) => {
            const customer = customers.find(c => c.id === id);
            if (customer) {
              setServedHistory(prev => [{ ...customer, status: 'served' as const }, ...prev].slice(0, 5));
            }
            try {
              const response = await updateSessionStatus(id, 'finished');
              if (response.success) {
                await loadQueueStatus();
              } else {
                console.error('Failed to mark served:', response.error);
              }
            } catch (e) {
              console.error('Failed to mark served:', e);
            }
          }}
          onMarkMissed={async (id) => {
            try {
              const response = await updateSessionStatus(id, 'missed');
              if (response.success) {
                await loadQueueStatus();
              } else {
                console.error('Failed to mark missed:', response.error);
              }
            } catch (e) {
              console.error('Failed to mark missed:', e);
            }
          }}
        />
      )}
      {currentView === 'analytics' && <AnalyticsMode stats={stats} />}
      {currentView === 'zones' && <ZonesMode entryPoints={entryPoints} onDelete={handleDeleteZone} onCreate={handleCreateZone} />}
      {currentView === 'content' && <ContentMode cards={marketingCards} onCreate={handleCreateCard} onUpdate={handleUpdateCard} onDelete={handleDeleteCard} />}
      {currentView === 'settings' && <SettingsMode settings={settings} onUpdate={handleUpdateSettings} storeId={storeId} />}
    </Layout>
  );
};
