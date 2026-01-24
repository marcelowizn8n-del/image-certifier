# Guia para Copiar Arquivos para o Novo Projeto Mobile

## Estrutura de Pastas Necessária

No novo projeto, crie estas pastas:
```
app/
app/(tabs)/
src/
src/lib/
src/contexts/
```

---

## ARQUIVO 1: app.json

```json
{
  "expo": {
    "name": "Image Certifier",
    "slug": "image-certifier",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a0a0f"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.imgcertifier.mobile",
      "infoPlist": {
        "NSCameraUsageDescription": "Image Certifier needs camera access to take photos for AI detection analysis",
        "NSPhotoLibraryUsageDescription": "Image Certifier needs photo library access to select images for AI detection analysis"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0a0a0f"
      },
      "package": "app.imgcertifier.mobile",
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE"]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Image Certifier to access your camera for AI detection analysis."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Image Certifier to access your photos for AI detection analysis."
        }
      ]
    ],
    "scheme": "imgcertifier"
  }
}
```

---

## ARQUIVO 2: app/_layout.tsx

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import '../src/lib/i18n';

function RootLayoutNav() {
  const { colorScheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <RootLayoutNav />
      </LanguageProvider>
    </ThemeProvider>
  );
}
```

---

## ARQUIVO 3: app/(tabs)/_layout.tsx

```tsx
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.upload'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## ARQUIVO 4: src/lib/theme.ts

```ts
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
```

---

## ARQUIVO 5: src/lib/api.ts

```ts
const API_BASE_URL = 'https://www.imgcertifier.app';

export interface AnalysisResult {
  id: number;
  result: 'original' | 'ai_generated' | 'ai_modified' | 'uncertain';
  confidence: number;
  artifacts?: {
    textureAnomalies?: boolean;
    lightingInconsistencies?: boolean;
    anatomicalIssues?: boolean;
    patternRepetition?: boolean;
    colorArtifacts?: boolean;
    blurringAnomalies?: boolean;
    edgeArtifacts?: boolean;
  };
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    hasExif?: boolean;
    cameraMake?: string;
    cameraModel?: string;
  };
  debugScores?: {
    aiScore: number;
    originalScore: number;
    modifiedScore: number;
    exifBoost: number;
    artifactPenalty: number;
    finalConfidence: number;
  };
  createdAt?: string;
}

export const analyzeImage = async (imageBase64: string): Promise<AnalysisResult> => {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: imageBase64 }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Analysis failed' }));
    throw new Error(error.message || 'Analysis failed');
  }

  return response.json();
};

export const analyzeImageUrl = async (url: string): Promise<AnalysisResult> => {
  const response = await fetch(`${API_BASE_URL}/api/analyze-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Analysis failed' }));
    throw new Error(error.message || 'Analysis failed');
  }

  return response.json();
};

export const getAnalysisHistory = async (): Promise<AnalysisResult[]> => {
  const response = await fetch(`${API_BASE_URL}/api/analyses`);
  if (!response.ok) {
    throw new Error('Failed to fetch history');
  }
  return response.json();
};
```

---

## ARQUIVO 6: src/lib/i18n.ts

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

const resources = {
  pt: {
    translation: {
      app: { name: 'Image Certifier', tagline: 'Verificacao de Autenticidade de Imagens' },
      tabs: { upload: 'Analisar', history: 'Historico', settings: 'Config' },
      upload: {
        title: 'Analise de Imagem',
        subtitle: 'Envie uma imagem para verificar autenticidade',
        selectImage: 'Selecionar Imagem',
        takePhoto: 'Tirar Foto',
        fromUrl: 'URL da Imagem',
        urlPlaceholder: 'Cole a URL aqui',
        analyze: 'Analisar Imagem',
        analyzing: 'Analisando...',
        newAnalysis: 'Nova Analise',
      },
      result: {
        certifiedImage: 'Imagem Certificada',
        original: 'Original',
        ai_generated: 'Gerada por IA',
        ai_modified: 'Modificada por IA',
        uncertain: 'Incerto',
        confidence: 'Confianca',
        artifacts: 'Artefatos Detectados',
        metadata: 'Metadados',
        download: 'Baixar com Selo',
        share: 'Compartilhar',
      },
      history: {
        title: 'Historico',
        empty: 'Nenhuma analise ainda',
        total: 'Total de Analises',
      },
      settings: {
        title: 'Configuracoes',
        language: 'Idioma',
        theme: 'Tema',
        dark: 'Escuro',
        light: 'Claro',
        auto: 'Automatico',
        about: 'Sobre',
        privacy: 'Privacidade',
        terms: 'Termos de Uso',
        version: 'Versao',
      },
      common: {
        loading: 'Carregando...',
        error: 'Erro',
        success: 'Sucesso',
        cancel: 'Cancelar',
        save: 'Salvar',
        delete: 'Excluir',
        confirm: 'Confirmar',
      },
    },
  },
  en: {
    translation: {
      app: { name: 'Image Certifier', tagline: 'Image Authenticity Verification' },
      tabs: { upload: 'Analyze', history: 'History', settings: 'Settings' },
      upload: {
        title: 'Image Analysis',
        subtitle: 'Upload an image to verify authenticity',
        selectImage: 'Select Image',
        takePhoto: 'Take Photo',
        fromUrl: 'Image URL',
        urlPlaceholder: 'Paste URL here',
        analyze: 'Analyze Image',
        analyzing: 'Analyzing...',
        newAnalysis: 'New Analysis',
      },
      result: {
        certifiedImage: 'Certified Image',
        original: 'Original',
        ai_generated: 'AI Generated',
        ai_modified: 'AI Modified',
        uncertain: 'Uncertain',
        confidence: 'Confidence',
        artifacts: 'Detected Artifacts',
        metadata: 'Metadata',
        download: 'Download with Seal',
        share: 'Share',
      },
      history: {
        title: 'History',
        empty: 'No analyses yet',
        total: 'Total Analyses',
      },
      settings: {
        title: 'Settings',
        language: 'Language',
        theme: 'Theme',
        dark: 'Dark',
        light: 'Light',
        auto: 'Auto',
        about: 'About',
        privacy: 'Privacy',
        terms: 'Terms of Use',
        version: 'Version',
      },
      common: {
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        confirm: 'Confirm',
      },
    },
  },
  es: {
    translation: {
      app: { name: 'Image Certifier', tagline: 'Verificacion de Autenticidad de Imagenes' },
      tabs: { upload: 'Analizar', history: 'Historial', settings: 'Ajustes' },
      upload: {
        title: 'Analisis de Imagen',
        subtitle: 'Sube una imagen para verificar autenticidad',
        selectImage: 'Seleccionar Imagen',
        takePhoto: 'Tomar Foto',
        fromUrl: 'URL de la Imagen',
        urlPlaceholder: 'Pega la URL aqui',
        analyze: 'Analizar Imagen',
        analyzing: 'Analizando...',
        newAnalysis: 'Nuevo Analisis',
      },
      result: {
        certifiedImage: 'Imagen Certificada',
        original: 'Original',
        ai_generated: 'Generada por IA',
        ai_modified: 'Modificada por IA',
        uncertain: 'Incierto',
        confidence: 'Confianza',
        artifacts: 'Artefactos Detectados',
        metadata: 'Metadatos',
        download: 'Descargar con Sello',
        share: 'Compartir',
      },
      history: {
        title: 'Historial',
        empty: 'Sin analisis aun',
        total: 'Total de Analisis',
      },
      settings: {
        title: 'Ajustes',
        language: 'Idioma',
        theme: 'Tema',
        dark: 'Oscuro',
        light: 'Claro',
        auto: 'Automatico',
        about: 'Acerca de',
        privacy: 'Privacidad',
        terms: 'Terminos de Uso',
        version: 'Version',
      },
      common: {
        loading: 'Cargando...',
        error: 'Error',
        success: 'Exito',
        cancel: 'Cancelar',
        save: 'Guardar',
        delete: 'Eliminar',
        confirm: 'Confirmar',
      },
    },
  },
  fr: {
    translation: {
      app: { name: 'Image Certifier', tagline: 'Verification Authenticite Images' },
      tabs: { upload: 'Analyser', history: 'Historique', settings: 'Parametres' },
      upload: {
        title: 'Analyse Image',
        subtitle: 'Telechargez une image pour verifier authenticite',
        selectImage: 'Selectionner Image',
        takePhoto: 'Prendre Photo',
        fromUrl: 'URL Image',
        urlPlaceholder: 'Collez URL ici',
        analyze: 'Analyser Image',
        analyzing: 'Analyse en cours...',
        newAnalysis: 'Nouvelle Analyse',
      },
      result: {
        certifiedImage: 'Image Certifiee',
        original: 'Original',
        ai_generated: 'Generee par IA',
        ai_modified: 'Modifiee par IA',
        uncertain: 'Incertain',
        confidence: 'Confiance',
        artifacts: 'Artefacts Detectes',
        metadata: 'Metadonnees',
        download: 'Telecharger avec Sceau',
        share: 'Partager',
      },
      history: {
        title: 'Historique',
        empty: 'Pas encore analyses',
        total: 'Total Analyses',
      },
      settings: {
        title: 'Parametres',
        language: 'Langue',
        theme: 'Theme',
        dark: 'Sombre',
        light: 'Clair',
        auto: 'Automatique',
        about: 'A propos',
        privacy: 'Confidentialite',
        terms: 'Conditions Utilisation',
        version: 'Version',
      },
      common: {
        loading: 'Chargement...',
        error: 'Erreur',
        success: 'Succes',
        cancel: 'Annuler',
        save: 'Enregistrer',
        delete: 'Supprimer',
        confirm: 'Confirmer',
      },
    },
  },
  de: {
    translation: {
      app: { name: 'Image Certifier', tagline: 'Bildauthentizitaetspruefung' },
      tabs: { upload: 'Analysieren', history: 'Verlauf', settings: 'Einstellungen' },
      upload: {
        title: 'Bildanalyse',
        subtitle: 'Laden Sie ein Bild hoch um Authentizitaet zu pruefen',
        selectImage: 'Bild auswaehlen',
        takePhoto: 'Foto aufnehmen',
        fromUrl: 'Bild-URL',
        urlPlaceholder: 'URL hier einfuegen',
        analyze: 'Bild analysieren',
        analyzing: 'Analysiere...',
        newAnalysis: 'Neue Analyse',
      },
      result: {
        certifiedImage: 'Zertifiziertes Bild',
        original: 'Original',
        ai_generated: 'KI-generiert',
        ai_modified: 'KI-modifiziert',
        uncertain: 'Unsicher',
        confidence: 'Vertrauen',
        artifacts: 'Erkannte Artefakte',
        metadata: 'Metadaten',
        download: 'Mit Siegel herunterladen',
        share: 'Teilen',
      },
      history: {
        title: 'Verlauf',
        empty: 'Noch keine Analysen',
        total: 'Gesamtanalysen',
      },
      settings: {
        title: 'Einstellungen',
        language: 'Sprache',
        theme: 'Thema',
        dark: 'Dunkel',
        light: 'Hell',
        auto: 'Automatisch',
        about: 'Ueber',
        privacy: 'Datenschutz',
        terms: 'Nutzungsbedingungen',
        version: 'Version',
      },
      common: {
        loading: 'Laden...',
        error: 'Fehler',
        success: 'Erfolg',
        cancel: 'Abbrechen',
        save: 'Speichern',
        delete: 'Loeschen',
        confirm: 'Bestaetigen',
      },
    },
  },
  zh: {
    translation: {
      app: { name: 'Image Certifier', tagline: '图像真实性验证' },
      tabs: { upload: '分析', history: '历史', settings: '设置' },
      upload: {
        title: '图像分析',
        subtitle: '上传图像以验证真实性',
        selectImage: '选择图像',
        takePhoto: '拍照',
        fromUrl: '图像URL',
        urlPlaceholder: '在此粘贴URL',
        analyze: '分析图像',
        analyzing: '分析中...',
        newAnalysis: '新分析',
      },
      result: {
        certifiedImage: '认证图片',
        original: '原创',
        ai_generated: 'AI生成',
        ai_modified: 'AI修改',
        uncertain: '不确定',
        confidence: '置信度',
        artifacts: '检测到的伪影',
        metadata: '元数据',
        download: '下载带印章',
        share: '分享',
      },
      history: {
        title: '历史',
        empty: '暂无分析',
        total: '总分析次数',
      },
      settings: {
        title: '设置',
        language: '语言',
        theme: '主题',
        dark: '暗色',
        light: '亮色',
        auto: '自动',
        about: '关于',
        privacy: '隐私',
        terms: '使用条款',
        version: '版本',
      },
      common: {
        loading: '加载中...',
        error: '错误',
        success: '成功',
        cancel: '取消',
        save: '保存',
        delete: '删除',
        confirm: '确认',
      },
    },
  },
};

const getDeviceLanguage = () => {
  const locale = Localization.locale;
  const lang = locale.split('-')[0];
  return ['pt', 'en', 'es', 'fr', 'de', 'zh'].includes(lang) ? lang : 'en';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

---

## ARQUIVO 7: src/contexts/ThemeContext.tsx

```tsx
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
```

---

## ARQUIVO 8: src/contexts/LanguageContext.tsx

```tsx
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
  { code: 'pt', name: 'Portugues', label: 'PT' },
  { code: 'en', name: 'English', label: 'EN' },
  { code: 'es', name: 'Espanol', label: 'ES' },
  { code: 'fr', name: 'Francais', label: 'FR' },
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
```

---

## PACOTES NECESSARIOS (package.json dependencies)

Peça ao Agent do novo projeto para instalar:

```
expo-router
expo-camera
expo-image-picker
expo-file-system
expo-localization
expo-constants
expo-status-bar
i18next
react-i18next
@react-native-async-storage/async-storage
react-native-safe-area-context
@expo/vector-icons
```

---

## PROXIMOS PASSOS

1. No novo projeto Replit, peça ao Agent para usar este codigo
2. Cole o conteudo de cada arquivo nos locais corretos
3. Instale os pacotes necessarios
4. Teste o app com Expo Go
5. Use a opcao "Publish to App Store" no Replit

---

## ARQUIVO 9: app/(tabs)/index.tsx

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { analyzeImage, analyzeImageUrl, AnalysisResult } from '../../src/lib/api';
import { getResultColor } from '../../src/lib/theme';

export default function UploadScreen() {
  const { t } = useTranslation();
  const { colors, colorScheme } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setResult(null);
    }
  };

  const analyzeCurrentImage = async () => {
    if (!imageUri && !imageUrl) {
      Alert.alert('No image', 'Please select an image or enter a URL');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      let analysisResult: AnalysisResult;

      if (imageUrl) {
        analysisResult = await analyzeImageUrl(imageUrl);
      } else if (imageUri) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mimeType = imageUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        analysisResult = await analyzeImage(\`data:\${mimeType};base64,\${base64}\`);
      } else {
        throw new Error('No image available');
      }

      setResult(analysisResult);
    } catch (error: any) {
      Alert.alert('Analysis Error', error.message || 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setImageUri(null);
    setImageUrl('');
    setResult(null);
  };

  const getResultText = () => {
    if (!result) return '';
    switch (result.result) {
      case 'original':
        return t('result.original');
      case 'ai_generated':
        return t('result.ai_generated');
      case 'ai_modified':
        return t('result.ai_modified');
      default:
        return t('result.uncertain');
    }
  };

  const getResultIcon = () => {
    if (!result) return 'help-circle';
    switch (result.result) {
      case 'original':
        return 'checkmark-circle';
      case 'ai_generated':
        return 'warning';
      case 'ai_modified':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('upload.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('upload.subtitle')}
          </Text>
        </View>

        {!result ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {imageUri ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={[styles.removeButton, { backgroundColor: colors.destructive }]}
                    onPress={() => setImageUri(null)}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadButtons}>
                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: colors.primary }]}
                    onPress={pickImage}
                  >
                    <Ionicons name="images-outline" size={24} color={colors.primaryForeground} />
                    <Text style={[styles.uploadButtonText, { color: colors.primaryForeground }]}>
                      {t('upload.selectImage')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: colors.secondary }]}
                    onPress={takePhoto}
                  >
                    <Ionicons name="camera-outline" size={24} color={colors.text} />
                    <Text style={[styles.uploadButtonText, { color: colors.text }]}>
                      {t('upload.takePhoto')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.urlSection}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('upload.fromUrl')}
                </Text>
                <TextInput
                  style={[
                    styles.urlInput,
                    { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder={t('upload.urlPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.analyzeButton,
                { backgroundColor: colors.primary },
                (!imageUri && !imageUrl) && styles.buttonDisabled,
              ]}
              onPress={analyzeCurrentImage}
              disabled={isAnalyzing || (!imageUri && !imageUrl)}
            >
              {isAnalyzing ? (
                <>
                  <ActivityIndicator color={colors.primaryForeground} />
                  <Text style={[styles.analyzeButtonText, { color: colors.primaryForeground }]}>
                    {t('upload.analyzing')}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="scan" size={24} color={colors.primaryForeground} />
                  <Text style={[styles.analyzeButtonText, { color: colors.primaryForeground }]}>
                    {t('upload.analyze')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={getResultIcon() as any}
                  size={40}
                  color={getResultColor(result.result, colorScheme)}
                />
                <View style={styles.resultTextContainer}>
                  <Text style={[styles.resultTitle, { color: getResultColor(result.result, colorScheme) }]}>
                    {getResultText()}
                  </Text>
                  <Text style={[styles.resultConfidence, { color: colors.textSecondary }]}>
                    {t('result.confidence')}: {result.confidence}%
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: colors.secondary }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: getResultColor(result.result, colorScheme),
                        width: \`\${result.confidence}%\`,
                      },
                    ]}
                  />
                </View>
              </View>

              {result.artifacts && Object.keys(result.artifacts).some((k) => result.artifacts?.[k as keyof typeof result.artifacts]) && (
                <View style={styles.artifactsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('result.artifacts')}
                  </Text>
                  <View style={styles.artifactsList}>
                    {Object.entries(result.artifacts).map(
                      ([key, value]) =>
                        value && (
                          <View key={key} style={[styles.artifactBadge, { backgroundColor: colors.secondary }]}>
                            <Text style={[styles.artifactText, { color: colors.text }]}>
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Text>
                          </View>
                        )
                    )}
                  </View>
                </View>
              )}

              {result.metadata && (
                <View style={styles.metadataSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {t('result.metadata')}
                  </Text>
                  <View style={styles.metadataGrid}>
                    <View style={styles.metadataItem}>
                      <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>Dimensions</Text>
                      <Text style={[styles.metadataValue, { color: colors.text }]}>
                        {result.metadata.width} x {result.metadata.height}
                      </Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>Format</Text>
                      <Text style={[styles.metadataValue, { color: colors.text }]}>
                        {result.metadata.format}
                      </Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>EXIF</Text>
                      <Text style={[styles.metadataValue, { color: colors.text }]}>
                        {result.metadata.hasExif ? 'Yes' : 'No'}
                      </Text>
                    </View>
                    {result.metadata.cameraMake && (
                      <View style={styles.metadataItem}>
                        <Text style={[styles.metadataLabel, { color: colors.textTertiary }]}>Camera</Text>
                        <Text style={[styles.metadataValue, { color: colors.text }]}>
                          {result.metadata.cameraMake}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.newAnalysisButton, { backgroundColor: colors.secondary }]}
              onPress={resetAnalysis}
            >
              <Ionicons name="refresh" size={24} color={colors.text} />
              <Text style={[styles.newAnalysisButtonText, { color: colors.text }]}>
                {t('upload.newAnalysis')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  urlSection: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  urlInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 10,
  },
  analyzeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultConfidence: {
    fontSize: 16,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  artifactsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  artifactsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  artifactBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  artifactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metadataSection: {},
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metadataItem: {
    width: '48%',
  },
  metadataLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  newAnalysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  newAnalysisButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
\`\`\`

---

## ARQUIVO 10: app/(tabs)/history.tsx

\`\`\`tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { getAnalysisHistory, AnalysisResult } from '../../src/lib/api';
import { getResultColor } from '../../src/lib/theme';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { colors, colorScheme } = useTheme();
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async () => {
    try {
      const data = await getAnalysisHistory();
      setAnalyses(data);
    } catch (error) {
      console.log('Failed to load history');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'original':
        return 'checkmark-circle';
      case 'ai_generated':
        return 'warning';
      case 'ai_modified':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const getResultText = (result: string) => {
    switch (result) {
      case 'original':
        return t('result.original');
      case 'ai_generated':
        return t('result.ai_generated');
      case 'ai_modified':
        return t('result.ai_modified');
      default:
        return t('result.uncertain');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: AnalysisResult }) => (
    <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.itemHeader}>
        <Ionicons
          name={getResultIcon(item.result) as any}
          size={28}
          color={getResultColor(item.result, colorScheme)}
        />
        <View style={styles.itemContent}>
          <Text style={[styles.itemResult, { color: getResultColor(item.result, colorScheme) }]}>
            {getResultText(item.result)}
          </Text>
          <Text style={[styles.itemConfidence, { color: colors.textSecondary }]}>
            {t('result.confidence')}: {item.confidence}%
          </Text>
        </View>
        <Text style={[styles.itemDate, { color: colors.textTertiary }]}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
      {item.metadata && (
        <View style={styles.itemMeta}>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {item.metadata.width}x{item.metadata.height} - {item.metadata.format}
          </Text>
        </View>
      )}
    </View>
  );

  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="time-outline" size={64} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {t('history.empty')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('history.title')}</Text>
        {analyses.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
              {analyses.length}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={analyses}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={!isLoading ? EmptyComponent : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
    flexGrow: 1,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemResult: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemConfidence: {
    fontSize: 14,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 12,
  },
  itemMeta: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  metaText: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
\`\`\`

---

## ARQUIVO 11: app/(tabs)/settings.tsx

\`\`\`tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, theme, setTheme } = useTheme();
  const { language, setLanguage, languages } = useLanguage();

  const themeOptions = [
    { key: 'auto' as const, label: t('settings.auto'), icon: 'phone-portrait-outline' },
    { key: 'light' as const, label: t('settings.light'), icon: 'sunny-outline' },
    { key: 'dark' as const, label: t('settings.dark'), icon: 'moon-outline' },
  ];

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.title')}</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('settings.language')}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {languages.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.optionRow,
                  index !== languages.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  language === lang.code && { backgroundColor: colors.secondary },
                ]}
                onPress={() => setLanguage(lang.code)}
              >
                <Text style={[styles.langLabel, { color: colors.primary }]}>{lang.label}</Text>
                <Text style={[styles.optionText, { color: colors.text }]}>{lang.name}</Text>
                {language === lang.code && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('settings.theme')}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {themeOptions.map((option, index) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionRow,
                  index !== themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  theme === option.key && { backgroundColor: colors.secondary },
                ]}
                onPress={() => setTheme(option.key)}
              >
                <Ionicons name={option.icon as any} size={20} color={colors.textSecondary} />
                <Text style={[styles.optionText, { color: colors.text }]}>{option.label}</Text>
                {theme === option.key && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('settings.about')}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.optionRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => openLink('https://imgcertifier.app/privacy')}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.optionText, { color: colors.text }]}>{t('settings.privacy')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => openLink('https://imgcertifier.app/terms')}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.optionText, { color: colors.text }]}>{t('settings.terms')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <View style={styles.optionRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.optionText, { color: colors.text }]}>{t('settings.version')}</Text>
              <Text style={[styles.versionText, { color: colors.textTertiary }]}>
                {Constants.expoConfig?.version || '1.0.0'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Image Certifier
          </Text>
          <Text style={[styles.footerSubtext, { color: colors.textTertiary }]}>
            Developed by MFA
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  langLabel: {
    fontSize: 14,
    fontWeight: '700',
    width: 28,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  versionText: {
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
});
\`\`\`
