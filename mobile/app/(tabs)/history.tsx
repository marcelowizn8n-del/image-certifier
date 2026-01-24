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
            {item.metadata.width}x{item.metadata.height} • {item.metadata.format}
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
