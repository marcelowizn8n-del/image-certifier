import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useIAP } from '../../src/contexts/IAPContext';

const PLAN_DETAILS = [
  {
    sku: 'app.imgcertifier.basic.monthly',
    tier: 'basic',
    icon: 'shield-checkmark-outline' as const,
    analyses: '50',
  },
  {
    sku: 'app.imgcertifier.premium.monthly',
    tier: 'premium',
    icon: 'diamond-outline' as const,
    analyses: '∞',
    popular: true,
  },
  {
    sku: 'app.imgcertifier.enterprise.monthly',
    tier: 'enterprise',
    icon: 'rocket-outline' as const,
    analyses: '∞',
  },
];

export default function SubscribeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { subscriptions, isPremium, isLoading, purchaseInProgress, subscribe, restorePurchases } = useIAP();

  const getPrice = (sku: string): string => {
    const sub = subscriptions.find((s) => s.productId === sku);
    if (!sub) return '---';
    const subAny = sub as any;
    if (Platform.OS === 'ios') {
      return subAny.localizedPrice || '---';
    }
    // Android
    const offer = subAny?.subscriptionOfferDetails?.[0];
    const phase = offer?.pricingPhases?.pricingPhaseList?.[0];
    return phase?.formattedPrice || subAny.localizedPrice || '---';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isPremium) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
          <Text style={[styles.premiumTitle, { color: colors.text }]}>
            {t('subscribe.alreadyPremium')}
          </Text>
          <Text style={[styles.premiumSubtitle, { color: colors.textSecondary }]}>
            {t('subscribe.enjoyFeatures')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="star" size={40} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>
            {t('subscribe.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('subscribe.subtitle')}
          </Text>
        </View>

        <View style={styles.features}>
          {[
            { icon: 'analytics-outline', key: 'unlimitedAnalyses' },
            { icon: 'flash-outline', key: 'priorityProcessing' },
            { icon: 'shield-checkmark-outline', key: 'advancedDetection' },
            { icon: 'cloud-download-outline', key: 'exportReports' },
          ].map((feature) => (
            <View key={feature.key} style={styles.featureRow}>
              <Ionicons name={feature.icon as any} size={22} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.text }]}>
                {t(`subscribe.features.${feature.key}`)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          {PLAN_DETAILS.map((plan) => {
            const price = getPrice(plan.sku);
            return (
              <TouchableOpacity
                key={plan.sku}
                disabled={purchaseInProgress}
                onPress={() => subscribe(plan.sku)}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: plan.popular ? colors.primary : colors.border,
                    borderWidth: plan.popular ? 2 : 1,
                  },
                ]}
              >
                {plan.popular && (
                  <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.popularText}>{t('subscribe.popular')}</Text>
                  </View>
                )}
                <Ionicons name={plan.icon as any} size={28} color={colors.primary} />
                <Text style={[styles.planName, { color: colors.text }]}>
                  {t(`subscribe.plans.${plan.tier}.name`)}
                </Text>
                <Text style={[styles.planAnalyses, { color: colors.textSecondary }]}>
                  {plan.analyses} {t('subscribe.analysesPerMonth')}
                </Text>
                <Text style={[styles.planPrice, { color: colors.primary }]}>{price}</Text>
                <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>
                  /{t('subscribe.month')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {purchaseInProgress && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.textSecondary }]}>
              {t('subscribe.processing')}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={restorePurchases}
          disabled={purchaseInProgress}
        >
          <Text style={[styles.restoreText, { color: colors.primary }]}>
            {t('subscribe.restore')}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.legalText, { color: colors.textTertiary }]}>
          {t('subscribe.legal')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  premiumSubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  features: {
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
  },
  plans: {
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  popularText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  planAnalyses: {
    fontSize: 14,
    marginTop: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  planPeriod: {
    fontSize: 14,
  },
  processingOverlay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  processingText: {
    fontSize: 14,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  restoreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
});
