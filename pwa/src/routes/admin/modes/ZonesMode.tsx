import React, { useState, useEffect, useRef } from 'react';
import { EntryPoint } from '@/types/admin';
import { Download, ExternalLink, Plus, Copy, SmartphoneNfc, Trash2, X, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';

interface ZonesModeProps {
  entryPoints: EntryPoint[];
  onDelete: (id: string) => void;
  onCreate: (name: string, slug: string) => Promise<boolean>;
}

export const ZonesMode: React.FC<ZonesModeProps> = ({ entryPoints, onDelete, onCreate }) => {
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) {
      setError('Name and slug are required');
      return;
    }
    setCreating(true);
    setError('');
    const success = await onCreate(newName.trim(), newSlug.trim());
    setCreating(false);
    if (success) {
      setShowModal(false);
      setNewName('');
      setNewSlug('');
    } else {
      setError('Failed to create entry point. Slug may already exist.');
    }
  };
  
  const handleDownloadQR = async (url: string, name: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 500,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        }
      });
      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = `QR-${name.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (e) {
      console.error("Failed to download QR", e);
      alert("Could not download QR code. Please try again.");
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  // QR Code display component
  const QRCodeDisplay: React.FC<{ url: string; name: string }> = ({ url, name }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: 80,
          margin: 1,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF'
          }
        });
      }
    }, [url]);

    return (
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded"
        title={`QR for ${name}`}
      />
    );
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-end flex-shrink-0">
        <div>
           <h2 className="text-2xl font-serif font-bold text-slate-50">Entry Points</h2>
           <p className="text-slate-400 font-serif italic text-sm mt-0.5">Manage digital access terminals.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-teal-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-teal-300 transition-colors shadow-md shadow-teal-400/20 text-sm"
        >
          <Plus size={18} /> Add Entry Point
        </button>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold text-slate-50">New Entry Point</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNewSlug(generateSlug(e.target.value));
                  }}
                  placeholder="e.g. Main Entrance"
                  className="w-full bg-slate-900 border border-slate-700 text-slate-50 rounded-xl p-3 focus:ring-2 focus:ring-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Slug (URL)</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. main-entrance"
                  className="w-full bg-slate-900 border border-slate-700 text-slate-50 rounded-xl p-3 focus:ring-2 focus:ring-teal-400 focus:outline-none font-mono text-sm"
                />
                <p className="text-slate-500 text-xs mt-1">URL: kyros.neuroforge.club/q/{newSlug || '...'}</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || !newSlug.trim()}
                className="w-full bg-teal-400 text-slate-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                {creating ? 'Creating...' : 'Create Entry Point'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-2">
        {entryPoints.map((ep) => (
             <div key={ep.id} className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex gap-5 shadow-sm items-center relative group">

                {/* Delete Button - Top Right */}
                <button
                  onClick={() => {
                     if(window.confirm('Delete this entry point?')) onDelete(ep.id);
                  }}
                  className="absolute top-3 right-3 p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete Zone"
                >
                   <Trash2 size={16} />
                </button>

                {/* QR Code - Generated locally */}
                <div className="w-24 h-24 bg-white p-2 rounded-xl flex-none flex items-center justify-center border border-slate-700 shrink-0">
                   <QRCodeDisplay url={ep.url} name={ep.name} />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-1">
                   <div>
                      <h3 className="text-lg font-serif font-bold text-slate-50 flex items-center gap-2 truncate pr-8">
                         📍 {ep.name}
                      </h3>
                      {/* URL Container with Truncation */}
                      <div className="flex items-center gap-2 text-slate-400 text-xs mt-1.5 bg-slate-900/50 p-1.5 rounded-lg border border-slate-700/50">
                         <ExternalLink size={12} className="shrink-0" />
                         <span className="font-mono truncate select-all">{ep.url}</span>
                         <button onClick={() => handleCopyUrl(ep.url)} className="p-1 hover:text-teal-400 transition-colors shrink-0" title="Copy URL">
                            <Copy size={12} />
                         </button>
                      </div>
                   </div>

                   <div className="flex gap-3 mt-3">
                      <button 
                        onClick={() => handleDownloadQR(ep.url, ep.name)}
                        className="flex-1 bg-slate-900 border border-slate-700 hover:bg-slate-700 text-slate-50 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                         <Download size={14} /> Save QR
                      </button>
                      <button className="flex-1 bg-slate-900 border border-slate-700 hover:bg-slate-700 text-slate-50 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors opacity-50 cursor-not-allowed" title="Requires Hardware Bridge">
                         <SmartphoneNfc size={14} /> NFC
                      </button>
                   </div>
                </div>
             </div>
        ))}
      </div>

      <div className="bg-teal-400/10 border border-teal-400/30 p-5 rounded-2xl mt-auto">
         <h3 className="text-teal-500 font-serif font-bold mb-1 flex items-center gap-2 text-base">💡 Concierge Tip</h3>
         <p className="text-teal-500/80 text-xs font-serif leading-relaxed">
            Printing the QR Code? We recommend using the "Save QR" button to get a high-resolution PNG. For the "NFC Writer" feature, please ensure the Kyros Hardware Bridge is connected to this terminal.
         </p>
      </div>
    </div>
  );
};