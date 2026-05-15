import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QrCode, Radio, X, Camera, Loader2, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useSessionStore } from '@/store/useSessionStore';
import { createSession as apiCreateSession, getSession } from '@/lib/api/client';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId, status, createSession, clearSession } = useSessionStore();
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'scanning' | 'found'>('scanning');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryPointId, setEntryPointId] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader';
  
  // Ref to prevent double-firing (Fixes Double Ticket Bug)
  const joinAttemptedRef = useRef(false);

  // Check for existing valid session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      // If there's an existing session, validate it with the backend
      if (sessionId && (status === 'waiting' || status === 'called')) {
        setIsCheckingSession(true);
        try {
          const response = await getSession(sessionId);
          if (response.success && response.data) {
            const serverStatus = response.data.status;
            // Session still valid - navigate to waiting room
            if (serverStatus === 'waiting' || serverStatus === 'called') {
              navigate('/waiting');
              return;
            }
          }
          // Session no longer valid - clear it
          clearSession();
        } catch (e) {
          console.error('Error checking session:', e);
          clearSession();
        } finally {
          setIsCheckingSession(false);
        }
      }
    };

    checkExistingSession();
  }, []);

  // Read entry_point_id from URL on mount and auto-join
  useEffect(() => {
    // If we already attempted to join in this mount cycle, stop here
    if (joinAttemptedRef.current) return;

    // Don't auto-join if we're checking an existing session
    if (isCheckingSession) return;
    
    // Don't auto-join if we already have a valid session (navigation will happen)
    if (sessionId && (status === 'waiting' || status === 'called')) return;
    
    // Don't auto-join if user just left the queue (flag persists across effect re-runs)
    if (sessionStorage.getItem('kyros_just_left')) return;

    let detectedEp: string | null = null;

    // Check main URL path for /q/{slug} pattern (direct QR scan)
    const fullPath = window.location.pathname;
    const qMatch = fullPath.match(/\/q\/([^\/]+)/);
    if (qMatch && qMatch[1]) {
      detectedEp = qMatch[1];
    }

    // Check main URL query params
    if (!detectedEp) {
      const mainParams = new URLSearchParams(window.location.search);
      const mainEp = mainParams.get('ep');
      if (mainEp) {
        detectedEp = mainEp;
      }
    }

    // Check hash query params (HashRouter)
    if (!detectedEp) {
      const params = new URLSearchParams(location.search);
      const ep = params.get('ep');
      if (ep) {
        detectedEp = ep;
      }
    }

    if (detectedEp) {
      setEntryPointId(detectedEp);
      
      // Lock immediately before calling the async function
      joinAttemptedRef.current = true;
      
      // Auto-join when entry point detected from URL
      joinQueue(detectedEp);
    }
  }, [location, isCheckingSession, sessionId, status]);

  const joinQueue = async (epId: string) => {
    setIsJoining(true);
    setError(null);
    try {
      const response = await apiCreateSession(epId);
      if (response.success && response.data) {
        createSession({
          sessionId: response.data.session_id,
          ticketCode: response.data.ticket_code,
          storeName: response.data.store_name,
          storeId: response.data.store_id,
          position: response.data.position,
          estimatedWaitMinutes: response.data.position * 2,
          createdAt: Date.now()
        });
        navigate('/waiting');
      } else {
        const errorCode = response.error?.code || '';
        if (errorCode === 'QUEUE_CLOSED') {
          setError('Queue is currently closed. Please speak to our staff.');
        } else if (errorCode === 'ENTRY_POINT_NOT_FOUND') {
          setError('Invalid QR code. Please try scanning again.');
        } else {
          setError(response.error?.message || 'Failed to join queue. Please try again.');
        }
      }
    } catch (e: any) {
      console.error('Join queue error:', e);
      setError('Network error. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const extractEntryPointFromUrl = (url: string): string | null => {
    try {
      // Handle URLs like https://kyros.neuroforge.club/q/main-entrance
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const qIndex = pathParts.indexOf('q');
      if (qIndex !== -1 && pathParts[qIndex + 1]) {
        return pathParts[qIndex + 1]; // Return the slug
      }
      // Also handle ?ep= parameter
      const epParam = urlObj.searchParams.get('ep');
      if (epParam) return epParam;
    } catch {
      // If not a valid URL, check if it's just a slug/id
      if (url && !url.includes(' ')) return url;
    }
    return null;
  };

  const startCamera = async () => {
    setIsScanning(true);
    setScanStatus('scanning');
    setError(null);

    // Small delay to ensure DOM element exists
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            // QR code found!
            console.log('QR decoded:', decodedText);
            setScanStatus('found');

            // Extract entry point from scanned URL
            const scannedEntryPoint = extractEntryPointFromUrl(decodedText);

            if (scannedEntryPoint) {
              await stopCamera();
              setEntryPointId(scannedEntryPoint);
              await joinQueue(scannedEntryPoint);
            } else {
              setError('Invalid QR code format. Please scan a valid Kyros QR code.');
            }
          },
          () => {
            // QR code not found in frame - this is normal, keep scanning
          }
        );
      } catch (err) {
        console.error("Error starting QR scanner:", err);
        setError("Unable to access camera. Please ensure permissions are granted.");
        setIsScanning(false);
      }
    }, 100);
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  // Manual join - clear the "just left" flag when user explicitly clicks
  const handleJoinClick = async () => {
    // Clear flag so user can join after previously leaving
    sessionStorage.removeItem('kyros_just_left');
    if (entryPointId) {
      await joinQueue(entryPointId);
    } else {
      setError('Please scan a QR code to join the queue.');
    }
  };

  // Show loading while checking existing session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 size={48} className="animate-spin text-teal-400 mb-4" />
        <p className="text-slate-400">Checking your session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 animate-[fade-in_0.5s_ease-out]">

      {/* Camera Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
                <span className="text-white font-medium drop-shadow-md">Scan QR Code</span>
                <button onClick={stopCamera} className="text-white p-2 rounded-full bg-white/20 backdrop-blur-md">
                    <X size={24} />
                </button>
            </div>

            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {/* QR Scanner Container */}
                <div
                  id={scannerContainerId}
                  className="w-full h-full"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />

                {scanStatus === 'found' && (
                     <div className="absolute bottom-32 bg-teal-400 text-slate-900 px-6 py-2 rounded-full font-bold shadow-lg animate-bounce z-30">
                        QR Code Found!
                     </div>
                )}
            </div>
        </div>
      )}

      {/* Store Header */}
      <div className="text-center mt-8 mb-12">
        <h2 className="text-slate-400 text-sm font-medium tracking-widest uppercase mb-2">Welcome to</h2>
        <h1 className="text-3xl font-serif font-bold text-slate-50 leading-tight">KYROS<br/>Virtual Queue</h1>
      </div>

      {/* Main Value Prop */}
      <div className="text-center mb-8">
        <div className="w-16 h-1 bg-teal-400 mx-auto mb-6 opacity-30"></div>
        <p className="text-2xl text-teal-400 font-serif font-medium mb-3">The Concierge Service</p>
        <p className="text-slate-400 leading-relaxed max-w-xs mx-auto">Relax while we prepare for your consultation.</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto mb-8">
        {entryPointId ? (
          /* Entry point detected - show Join button */
          <div className="space-y-4">
            <button
              onClick={handleJoinClick}
              disabled={isJoining}
              className="w-full bg-teal-400 text-slate-900 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-teal-300 transition-colors disabled:opacity-50"
            >
              {isJoining ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Joining Queue...
                </>
              ) : (
                <>
                  <QrCode size={24} />
                  Join the Queue
                </>
              )}
            </button>
            <p className="text-center text-slate-400 text-sm">
              Tap the button to get your virtual ticket
            </p>
          </div>
        ) : (
          /* No entry point - show GET VIRTUAL TICKET section */
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Get Virtual Ticket</h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Scan QR Button */}
              <button
                onClick={startCamera}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-3 hover:bg-slate-700 transition-colors"
              >
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-teal-400">
                  <Camera size={24} />
                </div>
                <div className="text-center">
                  <span className="block text-slate-50 font-bold">Scan QR</span>
                  <span className="text-xs text-slate-400">USE CAMERA</span>
                </div>
              </button>

              {/* Tap NFC Button */}
              <button
                className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-3 hover:bg-slate-700 transition-colors"
              >
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-teal-400">
                  <Radio size={24} />
                </div>
                <div className="text-center">
                  <span className="block text-slate-50 font-bold">Tap NFC</span>
                  <span className="text-xs text-slate-400">USE SENSOR</span>
                </div>
              </button>
            </div>

            {/* Queue Info */}
            <p className="text-center text-slate-400 text-sm">
              Current Queue: <span className="text-slate-50">5 people</span> • Avg Wait: <span className="text-slate-50">~8 min</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};