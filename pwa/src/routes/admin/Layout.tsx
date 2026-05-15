import React from 'react';
import { ViewMode, StoreSettings, QueueStats } from '@/types/admin';
import { LayoutDashboard, BarChart3, Map, FileText, Settings, LogOut, Hexagon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  onLogout: () => void;
  storeName: string;
  stats: QueueStats;
  settings: StoreSettings;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onNavigate, 
  onLogout, 
  storeName,
  stats,
  settings
}) => {
  
  const NavItem = ({ view, icon: Icon, label }: { view: ViewMode, icon: React.ElementType, label: string }) => (
    <button
      onClick={() => onNavigate(view)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left font-medium text-sm mb-1 ${
        currentView === view 
          ? 'bg-teal-400 text-slate-900 shadow-md shadow-teal-400/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-50'
      }`}
    >
      <Icon size={20} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="h-screen flex bg-slate-900 font-sans overflow-hidden">
      {/* Sidebar - Restored Width & Text */}
      <aside className="w-52 border-r border-slate-700 flex flex-col bg-slate-900 z-20 flex-shrink-0">
        <div className="p-5 border-b border-slate-700 flex items-center gap-3 h-16 shrink-0">
          <div className="bg-teal-400/10 p-1.5 rounded-lg border border-teal-400/20">
             <Hexagon size={24} className="text-teal-400 fill-teal-400/10" />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif font-bold text-lg text-slate-50 tracking-tight leading-none">KYROS</h1>
            <div className="text-xs text-slate-400 uppercase tracking-widest leading-none mt-1">Concierge</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItem view="counter" icon={LayoutDashboard} label="Counter" />
          <NavItem view="analytics" icon={BarChart3} label="Analytics" />
          <NavItem view="zones" icon={Map} label="Zones" />
          <NavItem view="content" icon={FileText} label="Content" />
          <NavItem view="settings" icon={Settings} label="Settings" />
        </nav>

        <div className="p-3 border-t border-slate-700 shrink-0">
          <div className="bg-slate-800 p-3 rounded-xl mb-2 border border-slate-700">
             <div className="text-xs text-slate-400 uppercase font-bold mb-1 tracking-widest">Location</div>
             <div className="text-slate-50 font-serif font-bold truncate text-sm">{storeName}</div>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 w-full transition-colors text-xs font-bold border border-transparent hover:border-red-500/20 uppercase tracking-wider"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 h-full">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-700 bg-slate-900 flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-serif font-bold text-slate-50 capitalize">{currentView}</h2>
            <div className="h-6 w-px bg-slate-700"></div>
            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border tracking-wider uppercase ${
               settings.acceptingTickets 
                 ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' 
                 : 'bg-red-500/10 border-red-500/30 text-red-500'
            }`}>
               <div className={`w-2 h-2 rounded-full ${settings.acceptingTickets ? 'bg-teal-400 animate-pulse' : 'bg-red-500'}`}></div>
               {settings.acceptingTickets ? 'Open' : 'Closed'}
            </div>
            {/* Quick Stats */}
            <div className="text-sm text-slate-400 flex gap-4 font-serif italic">
               <span><strong>{stats.waitingCount}</strong> guests waiting</span>
               <span className="text-slate-600">•</span>
               <span><strong>~{stats.avgWaitMinutes} min</strong> wait</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-serif font-bold text-teal-400 border border-teal-400/30 shadow-sm">
                OP
             </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-900">
           {children}
        </div>
      </main>
    </div>
  );
};