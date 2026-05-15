import React, { useState } from 'react';
import { MarketingCard } from '@/types/admin';
import { Gift, Coffee, Info, Star, Trash2, Plus, Zap, Tag } from 'lucide-react';

interface ContentModeProps {
  cards: MarketingCard[];
  onCreate?: (card: Omit<MarketingCard, 'id' | 'isActive'>) => Promise<boolean>;
  onUpdate?: (id: string, card: Partial<MarketingCard>) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
}

export const ContentMode: React.FC<ContentModeProps> = ({ cards, onCreate, onUpdate, onDelete }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(cards[0]?.id || null);
  const [editingCard, setEditingCard] = useState<MarketingCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const selectedCard = cards.find(c => c.id === selectedCardId);

  // Sync editingCard when selectedCard changes
  React.useEffect(() => {
    if (selectedCard && !isCreating) {
      setEditingCard({ ...selectedCard });
    }
  }, [selectedCardId, selectedCard, isCreating]);

  const handleSave = async () => {
    if (!editingCard) return;

    // Force create path if no ID (new card)
    const shouldCreate = isCreating || !editingCard.id;

    if (shouldCreate && onCreate) {
      console.log('Creating new card:', { type: editingCard.type, title: editingCard.title });
      const success = await onCreate({
        type: editingCard.type,
        title: editingCard.title,
        content: editingCard.content,
        icon: editingCard.icon,
        theme: editingCard.theme,
        priority: editingCard.priority
      });
      if (success) {
        setIsCreating(false);
        setEditingCard(null);
      }
    } else if (onUpdate && editingCard.id) {
      console.log('Updating card:', editingCard.id);
      await onUpdate(editingCard.id, editingCard);
    }
  };

  const handleDelete = async () => {
    if (!selectedCardId || !onDelete) return;
    const success = await onDelete(selectedCardId);
    if (success) {
      setSelectedCardId(cards.find(c => c.id !== selectedCardId)?.id || null);
    }
  };

  const handleNewCard = () => {
    setIsCreating(true);
    setSelectedCardId(null);
    setEditingCard({
      id: '',
      type: 'INFO',
      title: 'New Card',
      content: 'Enter content here...',
      icon: 'Star',
      theme: 'blue',
      priority: 0,
      isActive: true
    });
  };

  // Helper: Get Icon based on Type/String
  const getIcon = (iconName: string, size = 20) => {
    switch (iconName) {
      case 'Gift': return <Gift size={size} />;
      case 'Coffee': return <Coffee size={size} />;
      case 'Info': return <Info size={size} />;
      default: return <Star size={size} />;
    }
  };

  // Helper: Get Icon based on Type (fallback)
  const getTypeIcon = (type: string, size = 20) => {
      switch (type) {
          case 'PROMO': return <Tag size={size} />;
          case 'TRIVIA': return <Zap size={size} />;
          case 'INFO': return <Info size={size} />;
          default: return <Star size={size} />;
      }
  }

  // Helper: Auto-determine color based on TYPE
  const getTypeColorClasses = (type: string) => {
     switch(type) {
        case 'PROMO': return { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500', hexBg: '#2D1B36', hexBorder: '#4A2F55' };
        case 'TRIVIA': return { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500', hexBg: '#3D2A1C', hexBorder: '#593E2B' };
        case 'INFO': return { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500', hexBg: '#1A2634', hexBorder: '#2C3E50' };
        case 'BRAND': return { bg: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-500', hexBg: '#1F4238', hexBorder: '#2F5D50' };
        default: return { bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500', hexBg: '#2E1F14', hexBorder: '#4A3B2F' };
     }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-serif font-bold text-slate-50">Content Cards</h2>
          <button onClick={handleNewCard} className="px-5 py-2.5 bg-teal-400 text-slate-900 rounded-xl hover:bg-teal-300 transition-colors shadow-sm text-sm font-bold flex items-center gap-2">
            <Plus size={18} /> New Card
          </button>
      </div>

      {/* 3-Column Layout: List | Editor | Preview */}
      <div className="flex-1 flex gap-4 min-h-0">
        
        {/* COL 1: Compact List */}
        <div className="w-1/3 min-w-[280px] flex flex-col gap-3 overflow-y-auto pr-2">
          {cards.map((card) => {
            const colors = getTypeColorClasses(card.type);
            return (
                <div 
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${
                    selectedCardId === card.id 
                    ? 'bg-slate-800 border-teal-400 ring-1 ring-teal-400 shadow-md' 
                    : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:shadow-sm'
                }`}
                >
                <div className="flex justify-between items-start">
                    <div className={`p-1.5 rounded-md text-white ${colors.bg} bg-opacity-20`}>
                        <span className={colors.text}>
                            {getIcon(card.icon, 16)}
                        </span>
                    </div>
                    {card.isActive && <span className="bg-teal-400/20 text-teal-400 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>}
                </div>
                
                <div>
                    <h3 className="font-serif font-bold text-slate-50 text-base leading-tight mb-1">{card.title}</h3>
                    {/* Added Content Preview */}
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{card.content}</p>
                </div>
                
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-500 pt-2 border-t border-slate-700/50 mt-1">
                    <span className={colors.text}>{card.type}</span>
                    <span>Priority: {card.priority}</span>
                </div>
                </div>
            );
          })}
        </div>

        {/* COL 2: Editor */}
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col shadow-sm min-w-[320px]">
           {editingCard ? (
             <>
               <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
                  <h2 className="text-xl font-serif font-bold text-slate-50">{isCreating ? 'New Card' : 'Edit Card'}</h2>
                  <div className="flex gap-2">
                     {!isCreating && (
                       <button onClick={handleDelete} className="px-3 py-2 border border-red-500/50 text-red-500 rounded-xl hover:bg-red-500/10 transition-colors">
                          <Trash2 size={18} />
                       </button>
                     )}
                     <button onClick={handleSave} className="px-5 py-2 bg-teal-400 text-slate-900 rounded-xl text-sm font-bold hover:bg-teal-300 transition-colors shadow-sm">
                        {isCreating ? 'Create' : 'Save'}
                     </button>
                  </div>
               </div>

               <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                  <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Title</label>
                     <input type="text" value={editingCard.title} onChange={e => setEditingCard({...editingCard, title: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 text-base focus:border-teal-400 focus:outline-none font-serif" />
                  </div>
                  <div className="flex-1 flex flex-col min-h-[140px]">
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Content</label>
                     <textarea value={editingCard.content} onChange={e => setEditingCard({...editingCard, content: e.target.value})} className="w-full h-full min-h-[120px] bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 text-base focus:border-teal-400 focus:outline-none font-sans resize-none leading-relaxed" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Type</label>
                        <select value={editingCard.type} onChange={e => setEditingCard({...editingCard, type: e.target.value as MarketingCard['type']})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 text-sm focus:border-teal-400 focus:outline-none">
                           <option value="PROMO">PROMO (Purple)</option>
                           <option value="TRIVIA">TRIVIA (Orange)</option>
                           <option value="INFO">INFO (Blue)</option>
                           <option value="BRAND">BRAND (Green)</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1 italic">Color determines card style automatically.</p>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                        <input type="number" value={editingCard.priority} onChange={e => setEditingCard({...editingCard, priority: parseInt(e.target.value) || 0})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-50 text-sm focus:border-teal-400 focus:outline-none" />
                     </div>
                  </div>
               </div>
             </>
           ) : (
             <div className="flex-1 flex items-center justify-center text-slate-400 font-serif italic text-lg">{cards.length === 0 ? 'No cards yet. Click "New Card" to create one.' : 'Select a card to edit'}</div>
           )}
        </div>

        {/* COL 3: Preview */}
        <div className="w-[300px] hidden xl:flex flex-col items-center justify-start pt-2">
             <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Live Preview</div>
             {editingCard && (() => {
                const colors = getTypeColorClasses(editingCard.type);
                return (
                    <div className="border-[6px] border-slate-700 rounded-[2.5rem] bg-slate-900 w-full aspect-[9/18] relative overflow-hidden shadow-2xl max-h-[600px]">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-700 rounded-b-xl z-20"></div>
                        <div className="h-full w-full bg-[#F3EBDD] p-5 flex items-center justify-center relative z-10">

                            {/* Card Mockup */}
                            <div
                                className={`w-full p-6 rounded-2xl shadow-xl relative overflow-hidden border`}
                                style={{ backgroundColor: colors.hexBg, borderColor: colors.hexBorder }}
                            >
                                <div className="flex items-center gap-3 mb-3 relative z-10">
                                    <span className="text-white">{getIcon(editingCard.icon, 18)}</span>
                                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{editingCard.type}</span>
                                </div>
                                <h4 className="font-serif font-bold text-[#F3EBDD] mb-3 text-lg leading-tight relative z-10">{editingCard.title}</h4>
                                <p className="text-xs text-[#E8DCCB]/80 leading-relaxed font-sans relative z-10">{editingCard.content}</p>

                                <div className="absolute -bottom-4 -right-4 opacity-5 z-0 text-white">
                                    {getIcon(editingCard.icon, 100)}
                                </div>
                            </div>

                        </div>
                    </div>
                );
             })()}
        </div>

      </div>
    </div>
  );
};