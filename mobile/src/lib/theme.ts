export const colors = {
  dark: {
    background: '#0a0a0f',
    card: '#111118',
    cardBorder: '#1e1e2a',
    primary: '#00d4ff',
    primaryForeground: '#000000',
    secondary: '#1e1e2a',
    secondaryForeground: '#ffffff',
    accent: '#0ea5e9',
    accentForeground: '#ffffff',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    success: '#22c55e',
    successForeground: '#ffffff',
    warning: '#f97316',
    warningForeground: '#ffffff',
    muted: '#27272a',
    mutedForeground: '#a1a1aa',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    textTertiary: '#71717a',
    border: '#27272a',
    ring: '#00d4ff',
  },
  light: {
    background: '#ffffff',
    card: '#f8f8fa',
    cardBorder: '#e4e4e7',
    primary: '#0891b2',
    primaryForeground: '#ffffff',
    secondary: '#f4f4f5',
    secondaryForeground: '#18181b',
    accent: '#0ea5e9',
    accentForeground: '#ffffff',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    success: '#22c55e',
    successForeground: '#ffffff',
    warning: '#f97316',
    warningForeground: '#000000',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    text: '#18181b',
    textSecondary: '#52525b',
    textTertiary: '#a1a1aa',
    border: '#e4e4e7',
    ring: '#0891b2',
  },
};

export type Theme = 'dark' | 'light' | 'auto';
export type ColorScheme = keyof typeof colors;

export const getResultColor = (result: string, scheme: ColorScheme) => {
  switch (result) {
    case 'original':
      return colors[scheme].success;
    case 'ai_generated':
      return colors[scheme].destructive;
    case 'ai_modified':
      return colors[scheme].warning;
    default:
      return colors[scheme].muted;
  }
};

export const getSealColor = (result: string) => {
  switch (result) {
    case 'original':
      return '#22c55e';
    case 'ai_generated':
      return '#ef4444';
    case 'ai_modified':
      return '#f97316';
    default:
      return '#71717a';
  }
};
