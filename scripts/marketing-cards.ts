/**
 * The demo store's content feed: the cards a customer scrolls through while waiting.
 *
 * Shared by scripts/db-seed.ts (fresh database) and scripts/db-cards.ts (reconcile an
 * existing one), so the two can never drift apart.
 *
 * Two hard constraints come from pwa/src/components/shared/MarketingCard.tsx, which is the
 * only thing that renders these:
 *
 *   icon_name    Gift | Coffee | Star | Info      anything else silently renders as Info
 *   theme_color  purple | orange | blue | green   anything else silently renders as blue
 *
 * The first seed used `Sparkles`, `Lightbulb` and `teal`, none of which exist in that map,
 * so two of the three cards drew the wrong icon and all three drew the same colour.
 *
 * Content rules follow knowledge/CLAUDE.md, because the concierge answers from that wiki and
 * a card that contradicts it makes the whole thing look broken: English only, no real brand
 * names, no verifiable claims. The store is "Riserva Espresso", which sells capsules,
 * machines and accessories -- see knowledge/public/product_catalog.md.
 */
export type SeedCard = {
  type: 'BRAND' | 'PROMO' | 'INFO' | 'TRIVIA';
  title: string;
  content: string;
  icon_name: string;
  theme_color: string;
  priority: number;
};

// Highest priority first: this is the order the waiting room shows them in.
export const MARKETING_CARDS: SeedCard[] = [
  {
    type: 'BRAND',
    title: 'Riserva Espresso',
    content:
      'Six house blends, four machines and everything in between. Our capsules are made in the Riserva format, so they fit our machines and nothing else.',
    icon_name: 'Coffee',
    theme_color: 'orange',
    priority: 40,
  },
  {
    type: 'PROMO',
    title: 'Riserva Card',
    content:
      'One point for every euro you spend, in store or online. A hundred points become a 5 euro voucher, and workshops and machines earn double. Signing up at the desk takes a minute.',
    icon_name: 'Gift',
    theme_color: 'purple',
    priority: 30,
  },
  {
    type: 'INFO',
    title: 'Tasting while you wait',
    content:
      'Ask our team for a tasting of up to three blends at the espresso bar. No booking, no charge: just say the word when your turn comes.',
    icon_name: 'Info',
    theme_color: 'blue',
    priority: 20,
  },
  {
    type: 'TRIVIA',
    title: 'Did you know?',
    content:
      'Intensity on a capsule is not a caffeine reading. It describes roast and body, which is why our darkest blend sits at 10 out of 12 and a lighter one can still wake you up just as well.',
    icon_name: 'Star',
    theme_color: 'green',
    priority: 10,
  },
];
