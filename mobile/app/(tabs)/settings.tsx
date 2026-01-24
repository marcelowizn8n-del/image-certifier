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
