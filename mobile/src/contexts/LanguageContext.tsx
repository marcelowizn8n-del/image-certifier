import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../lib/i18n';

type Language = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  languages: { code: Language; name: string; label: string }[];
}

const languages: { code: Language; name: string; label: string }[] = [
  { code: 'pt', name: 'Português', label: 'PT' },
  { code: 'en', name: 'English', label: 'EN' },
  { code: 'es', name: 'Español', label: 'ES' },
  { code: 'fr', name: 'Français', label: 'FR' },
  { code: 'de', name: 'Deutsch', label: 'DE' },
  { code: 'zh', name: '中文', label: 'ZH' },
];

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem('language');
      if (saved && languages.some((l) => l.code === saved)) {
        setLanguageState(saved as Language);
        i18n.changeLanguage(saved);
      }
    } catch (e) {
      console.log('Failed to load language');
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    try {
      await AsyncStorage.setItem('language', lang);
    } catch (e) {
      console.log('Failed to save language');
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
