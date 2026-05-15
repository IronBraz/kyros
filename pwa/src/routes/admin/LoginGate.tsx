import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Store } from '@/types/admin';
import { Delete, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { verifyPin, getStores } from '@/lib/api/admin';

export const LoginGate: React.FC = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Load stores on mount
  useEffect(() => {
    const loadStores = async () => {
      try {
        const response = await getStores();
        if (response.success && response.data) {
          const storesData = response.data.stores;
          if (Array.isArray(storesData)) {
            setStores(storesData);
            if (storesData.length > 0) setSelectedStoreId(storesData[0].id);
          } else if (storesData && typeof storesData === 'object') {
            const storeArray = [storesData as Store];
            setStores(storeArray);
            setSelectedStoreId(storeArray[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load stores:', e);
      }
    };
    loadStores();
  }, []);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setError(false);
    }
  };

  const handleClear = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || loading) return;

    setLoading(true);
    try {
      const response = await verifyPin(selectedStoreId, pin);
      if (response.success && response.data) {
        // Save session to localStorage
        localStorage.setItem('kyros_admin_session', JSON.stringify({
          token: response.data.session_token,
          store_id: response.data.store_id,
          store_name: response.data.store_name,
          expires_at: response.data.expires_at
        }));
        // Navigate to control room after successful login
        navigate('/control-room');
      } else {
        setError(true);
        setPin('');
      }
    } catch (e) {
      console.error('Login error:', e);
      setError(true);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
    } else if (e.key === 'Backspace') {
        handleClear();
    } else if (e.key === 'Enter') {
        handleSubmit();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-50 p-4" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
             <div className="bg-teal-400/10 p-4 rounded-full border border-teal-400/20">
                <ShieldCheck size={48} className="text-teal-400" />
             </div>
          </div>
          <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-50">Concierge Access</h1>
          <p className="text-slate-400 mt-2 font-serif italic">Enter your operator credential</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl shadow-slate-500/5">
          {/* Store Selector */}
          <div className="mb-8">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Select Location</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-50 rounded-xl p-3 focus:ring-2 focus:ring-teal-400 focus:outline-none font-serif"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          {/* PIN Display */}
          <div className="flex justify-center gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  i < pin.length ? 'bg-teal-400 scale-110' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleDigit(num.toString())}
                className="h-16 rounded-2xl bg-slate-900 border border-slate-700 text-2xl font-serif font-medium text-slate-50 hover:bg-slate-700 active:scale-95 transition-all shadow-sm"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-red-400 hover:bg-slate-700 active:scale-95 transition-all shadow-sm"
            >
              <Delete size={24} />
            </button>
            <button
              onClick={() => handleDigit('0')}
              className="h-16 rounded-2xl bg-slate-900 border border-slate-700 text-2xl font-serif font-medium text-slate-50 hover:bg-slate-700 active:scale-95 transition-all shadow-sm"
            >
              0
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || pin.length < 4}
              className="h-16 rounded-2xl bg-teal-400 text-slate-900 flex items-center justify-center font-bold hover:bg-teal-300 active:scale-95 transition-all shadow-md shadow-teal-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <ArrowRight size={24} />}
            </button>
          </div>

           {error && (
            <div className="mt-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-center text-sm font-serif italic animate-pulse">
              Invalid Credential.
            </div>
          )}
        </div>
        
        <p className="text-center text-slate-400 text-sm font-serif italic">
           Use your keyboard or the on-screen pad
        </p>
      </div>
    </div>
  );
};