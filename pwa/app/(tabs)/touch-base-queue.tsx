/**
 * Touch-Base Queue — staff/admin only. Mirrors web/src/pages/TouchBaseQueuePage.tsx.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { getTouchBaseQueue, markContacted, type TouchBaseQueueItem } from '../../api/touchBase';

function daysSince(iso: string | null, t: TFunction): string {
  if (!iso) return t('touchBase.neverContacted');
  const days = Math.round((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return t('touchBase.daysAgo', { count: days });
}

function formatThresholdDays(days: number, t: TFunction): string {
  if (days < 1) return t('touchBase.thresholdMin', { count: Math.round(days * 1440) });
  return t('touchBase.thresholdDays', { count: days });
}

export default function TouchBaseQueueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [queue, setQueue] = useState<TouchBaseQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contactingId, setContactingId] = useState<number | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      setQueue(await getTouchBaseQueue());
    } catch {
      // keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleMarkContacted(patientId: number) {
    setContactingId(patientId);
    try {
      await markContacted(patientId);
      setQueue((prev) => prev.filter((item) => item.id !== patientId));
    } catch {
      // non-fatal
    } finally {
      setContactingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('touchBase.queueTitle')}</Text>
        {!loading && (
          <Text style={styles.headerCount}>
            {t('touchBase.overdueCount', { count: queue.length })}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('touchBase.noPatientsOverdue')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/patient-dashboard/${item.id}`)} activeOpacity={0.8}>
              <Text style={styles.cardName}>{item.user.firstName} {item.user.lastName}</Text>
              <View style={styles.infoRow}>
                <View>
                  <Text style={styles.cardSub}>{t('touchBase.lastContact', { time: daysSince(item.lastContactAt, t) })}</Text>
                  <Text style={styles.cardSub}>{t('touchBase.threshold', { value: formatThresholdDays(item.thresholdDays, t) })}</Text>
                </View>
                <View style={[styles.badge, item.overdue ? styles.badgeOverdue : styles.badgeDue]}>
                  <Text style={[styles.badgeText, item.overdue ? styles.badgeTextOverdue : styles.badgeTextDue]}>
                    {item.overdue ? t('touchBase.overdue') : t('touchBase.dueSoon')}
                  </Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.contactedBtn]}
                  disabled={contactingId === item.id}
                  onPress={() => handleMarkContacted(item.id)}
                >
                  <Text style={styles.contactedBtnText}>{contactingId === item.id ? t('touchBase.saving') : t('touchBase.markAsContacted')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.messageBtn]}
                  onPress={() => router.push(`/messages/${item.id}`)}
                >
                  <Text style={styles.messageBtnText}>{t('touchBase.contactThem')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { ...(typography.h1 as object), color: colors.text.primary },
  headerCount: { ...(typography.caption as object), color: colors.text.muted },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardName: { ...(typography.body1 as object), fontWeight: '600' as const, color: colors.text.primary },
  cardSub: { ...(typography.caption as object), color: colors.text.secondary, marginTop: 2 },
  emptyText: { ...(typography.body2 as object), color: colors.text.muted, textAlign: 'center', paddingHorizontal: spacing.lg },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 4 },

  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeOverdue: { backgroundColor: colors.dangerBg },
  badgeDue: { backgroundColor: colors.warningBg },
  badgeText: { ...(typography.caption as object), fontWeight: '600' as const },
  badgeTextOverdue: { color: colors.danger },
  badgeTextDue: { color: colors.warning },

  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingVertical: spacing.sm + 4 },
  contactedBtn: { backgroundColor: colors.primaryBg },
  contactedBtnText: { ...(typography.caption as object), color: colors.primary, fontWeight: '600' as const },
  messageBtn: { backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border },
  messageBtnText: { ...(typography.caption as object), color: colors.text.primary, fontWeight: '600' as const },
});
