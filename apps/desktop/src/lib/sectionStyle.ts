export interface SectionStyle {
  hex: string;
  dotBg: string;
  badgeBg: string;
  stripeBg: string;
  textColor: string;
}

/**
 * 3-tier fallback resolution for section styling:
 * 1. section.color hex (if set in source file and valid).
 * 2. Name pattern matching.
 * 3. Slate neutral fallback.
 */
export function getSectionStyle(name: string, customColor?: string): SectionStyle {
  if (customColor && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(customColor)) {
    return {
      hex: customColor,
      dotBg: '',
      badgeBg: 'bg-muted text-foreground border-border',
      stripeBg: '',
      textColor: 'text-white',
    };
  }

  const n = name.toLowerCase();
  if (n.includes('intro')) {
    return {
      hex: '#F59E0B',
      dotBg: 'bg-amber-500',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      stripeBg: 'bg-amber-500',
      textColor: 'text-slate-950',
    };
  }
  if (n.includes('pre') && (n.includes('chorus') || n.includes('chœur') || n.includes('refrain'))) {
    return {
      hex: '#F97316',
      dotBg: 'bg-orange-500',
      badgeBg: 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      stripeBg: 'bg-orange-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('chorus') || n.includes('refrain') || n.includes('chœur') || n.includes('fiverezana')) {
    return {
      hex: '#EF4444',
      dotBg: 'bg-red-500',
      badgeBg: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
      stripeBg: 'bg-red-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('verse') || n.includes('couplet') || n.includes('andininy')) {
    return {
      hex: '#3B82F6',
      dotBg: 'bg-blue-500',
      badgeBg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      stripeBg: 'bg-blue-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('bridge') || n.includes('pont')) {
    return {
      hex: '#10B981',
      dotBg: 'bg-emerald-500',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      stripeBg: 'bg-emerald-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('tag')) {
    return {
      hex: '#A855F7',
      dotBg: 'bg-purple-500',
      badgeBg: 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      stripeBg: 'bg-purple-500',
      textColor: 'text-white',
    };
  }
  if (n.includes('outro') || n.includes('ending') || n.includes('fin')) {
    return {
      hex: '#EAB308',
      dotBg: 'bg-yellow-500',
      badgeBg: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
      stripeBg: 'bg-yellow-500',
      textColor: 'text-slate-950',
    };
  }

  return {
    hex: '#94A3B8',
    dotBg: 'bg-slate-500',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    stripeBg: 'bg-slate-500',
    textColor: 'text-white',
  };
}
