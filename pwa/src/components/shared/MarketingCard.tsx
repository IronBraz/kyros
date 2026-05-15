import React from 'react';
import { Gift, Coffee, Star, Info, ExternalLink } from 'lucide-react';
import { MarketingCard as MarketingCardType } from '@/types/shared';

const icons: Record<string, React.ElementType> = {
  Gift, Coffee, Star, Info
};

// Theme styles based on theme prop for visual differentiation
const themeStyles: Record<string, { bg: string; border: string; accent: string; badge: string }> = {
  purple: {
    bg: 'bg-gradient-to-br from-purple-500/15 to-pink-500/10',
    border: 'border-purple-500/40',
    accent: 'text-purple-400',
    badge: 'bg-purple-500/40 text-slate-900 font-bold'
  },
  orange: {
    bg: 'bg-gradient-to-br from-amber-500/15 to-orange-500/10',
    border: 'border-amber-500/40',
    accent: 'text-amber-400',
    badge: 'bg-amber-500/40 text-slate-900 font-bold'
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500/15 to-cyan-500/10',
    border: 'border-blue-500/40',
    accent: 'text-blue-400',
    badge: 'bg-blue-500/40 text-slate-900 font-bold'
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-500/15 to-teal-500/10',
    border: 'border-emerald-500/40',
    accent: 'text-emerald-400',
    badge: 'bg-emerald-500/40 text-slate-900 font-bold'
  }
};

export const MarketingCard: React.FC<MarketingCardType> = ({
  type, title, content, icon, theme, actionUrl
}) => {
  const Icon = icons[icon] || Info;
  const themeStyle = themeStyles[theme] || themeStyles.blue;

  return (
    <div className={`rounded-xl border-2 p-5 mb-4 ${themeStyle.bg} ${themeStyle.border} shadow-lg transition-all duration-500 animate-[fade-in-up_0.5s_ease-out]`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${themeStyle.bg} border ${themeStyle.border}`}>
          <Icon size={20} className={themeStyle.accent} />
        </div>
        <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-md ${themeStyle.badge}`}>
          {type}
        </span>
      </div>

      <h3 className="text-lg font-serif font-bold text-slate-50 mb-2">{title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed mb-4 font-medium">{content}</p>

      {actionUrl && (
        <a
          href={actionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center text-xs font-bold uppercase tracking-wider hover:opacity-70 underline decoration-1 underline-offset-4 ${themeStyle.accent}`}
        >
          Learn More <ExternalLink size={12} className="ml-1" />
        </a>
      )}
    </div>
  );
};
