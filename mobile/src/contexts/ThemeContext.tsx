import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, Theme, ColorScheme } from '../lib/theme';

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  colors: typeof colors.dark;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('auto');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('theme');
      if (saved && ['dark', 'light', 'auto'].includes(saved)) {
        setThemeState(saved as Theme);
      }
    } catch (e) {
      console.log('Failed to load theme');
    }
  };

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme);
    } catch (e) {
      console.log('Failed to save theme');
    }
  };

  const colorScheme: ColorScheme =
    theme === 'auto' ? (systemColorScheme === 'light' ? 'light' : 'dark') : theme;

  const value: ThemeContextType = {
    theme,
    colorScheme,
    colors: colors[colorScheme],
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
