import React, { useState } from 'react';
import { StoreSettings } from '@/types/admin';
import { ToggleRight, Save, Clock, MessageSquare, Sliders, Brain } from 'lucide-react';
import { WikiReloadCard } from '@/components/admin/WikiReloadCard';
import { AIUsageCard } from '@/components/admin/AIUsageCard';

interface SettingsModeProps {
  settings: StoreSettings;
  onUpdate: (settings: StoreSettings) => void;
  storeId: string;
}

export const SettingsMode: React.FC<SettingsModeProps> = ({ settings, onUpdate, storeId }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const toggleAccepting = () => {
    setLocalSettings(prev => ({ ...prev, acceptingTickets: !prev.acceptingTickets }));
  };

  const handleSave = () => {
    onUpdate(localSettings);
    // Toast logic would go here
  };

  return (
    <div className="h-full flex flex-col gap-5">
      
      {/* 1. Header & Queue Status (Top Bar) */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-sm shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-6">
           <div className={`p-3 rounded-full border ${localSettings.acceptingTickets ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
              <ToggleRight size={32} className={!localSettings.acceptingTickets ? "rotate-180" : ""} />
           </div>
           <div>
              <h2 className="text-xl font-serif font-bold text-slate-50 flex items-center gap-3">
                 Accepting Guests
                 {localSettings.acceptingTickets 
                   ? <span className="text-xs bg-teal-400/20 text-teal-400 px-2 py-0.5 rounded-md uppercase tracking-wider border border-teal-400/20 font-sans font-bold">Active</span>
                   : <span className="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded-md uppercase tracking-wider border border-red-500/20 font-sans font-bold">Closed</span>
                 }
              </h2>
              <p className="text-sm text-slate-400 mt-1 font-serif italic">
                 {localSettings.acceptingTickets 
                    ? "Digital queue is open via QR code." 
                    : "Queue locked. Existing guests can still be served."}
              </p>
           </div>
        </div>
        <button onClick={toggleAccepting} className={`px-6 py-3 rounded-xl font-bold transition-all border ${localSettings.acceptingTickets ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20' : 'bg-teal-400 text-slate-900 border-teal-400 hover:bg-teal-300'}`}>
            {localSettings.acceptingTickets ? 'Close Queue' : 'Open Queue'}
        </button>
      </div>

      {/* 2. Main Grid Content */}
      <div className="grid grid-cols-2 gap-5 min-h-0 flex-1">
         
         {/* Left Column: Technical Params */}
         <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col gap-6 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-700 pb-3 mb-2">
                <Sliders size={20} className="text-teal-400" />
                <h3 className="text-lg font-serif font-bold text-slate-50">Configuration</h3>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Clock size={12} /> Avg Service (min)
                    </label>
                    <input 
                        type="number"
                        value={localSettings.avgServiceTime}
                        onChange={e => setLocalSettings({...localSettings, avgServiceTime: parseInt(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 focus:border-teal-400 outline-none font-mono text-lg"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Clock size={12} /> Ghost Timeout (min)
                    </label>
                    <input 
                        type="number"
                        value={localSettings.ghostTimeout}
                        onChange={e => setLocalSettings({...localSettings, ghostTimeout: parseInt(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 focus:border-teal-400 outline-none font-mono text-lg"
                    />
                </div>
            </div>

            <div className="space-y-4 pt-2">
               <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Language</label>
                 <select 
                    value={localSettings.language}
                    onChange={e => setLocalSettings({...localSettings, language: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 focus:border-teal-400 outline-none"
                 >
                    <option value="it">Italiano (IT)</option>
                    <option value="en">English (EN)</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Notification Sound</label>
                 <select 
                    value={localSettings.callSound}
                    onChange={e => setLocalSettings({...localSettings, callSound: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 focus:border-teal-400 outline-none"
                 >
                    <option value="ding-dong">Ding Dong</option>
                    <option value="chime">Chime</option>
                    <option value="soft">Soft Bell</option>
                 </select>
               </div>
            </div>
         </div>

         {/* Right Column: Messaging */}
         <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-700 pb-3 mb-4">
                <MessageSquare size={20} className="text-teal-400" />
                <h3 className="text-lg font-serif font-bold text-slate-50">Messaging</h3>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Welcome Message</label>
                    <input
                        type="text"
                        value={localSettings.welcomeMessage}
                        onChange={e => setLocalSettings({...localSettings, welcomeMessage: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 focus:border-teal-400 outline-none text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1 italic">Shown when customer joins queue.</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Closed Message</label>
                    <textarea
                        value={localSettings.closedMessage}
                        onChange={e => setLocalSettings({...localSettings, closedMessage: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 focus:border-teal-400 outline-none text-sm h-16 resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1 italic">Shown when queue is closed.</p>
                </div>
            </div>
         </div>
      </div>

      {/* 3. AI / Pilot Section */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} className="text-teal-400" />
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">AI Concierge</h3>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <WikiReloadCard storeId={storeId} />
          <AIUsageCard storeId={storeId} />
        </div>
      </div>

      {/* 4. Footer Action */}
      <div className="flex justify-end pt-2 shrink-0">
         <button onClick={handleSave} className="bg-teal-400 text-slate-900 px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-teal-300 transition-colors shadow-lg shadow-teal-400/20 text-base">
            <Save size={18} /> Save Changes
         </button>
      </div>

    </div>
  );
};