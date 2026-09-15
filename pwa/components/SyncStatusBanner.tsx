import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useSyncStatus } from '../offline/SyncStatusContext';

/**
 * Small, non-blocking indicator for the offline sync queue. Shows nothing when there's
 * nothing pending or failed — never interrupts the screen underneath.
 */
export function SyncStatusBanner() {
  const { t } = useTranslation();
  const { pendingCount, failedItems, retry, discard } = useSyncStatus();
  const [expanded, setExpanded] = useState(false);

  if (pendingCount === 0 && failedItems.length === 0) return null;

  const hasFailed = failedItems.length > 0;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.chip, hasFailed && styles.chipWarning]}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.85}
      >
        <Text style={styles.chipText}>
          {hasFailed
            ? t('offlineSync.issuesChip', { count: failedItems.length })
            : t('offlineSync.syncingChip', { count: pendingCount })}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>
          <ScrollView style={styles.panelScroll}>
            {pendingCount > 0 && (
              <Text style={styles.panelInfo}>{t('offlineSync.pendingInfo', { count: pendingCount })}</Text>
            )}
            {failedItems.map((item) => (
              <View key={item.id} style={styles.failedRow}>
                <Text style={styles.failedText} numberOfLines={2}>{item.error ?? t('offlineSync.genericError')}</Text>
                <View style={styles.failedActions}>
                  <TouchableOpacity onPress={() => retry(item.id)} style={styles.actionBtn}>
                    <Text style={styles.retryText}>{t('offlineSync.retry')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => discard(item.id)} style={styles.actionBtn}>
                    <Text style={styles.discardText}>{t('offlineSync.discard')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    zIndex: 50,
    alignItems: 'flex-end',
  },
  chip: {
    backgroundColor: colors.text.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    ...shadows.md,
  },
  chipWarning: { backgroundColor: colors.warning ?? '#f59e0b' },
  chipText: { ...(typography.caption as object), color: colors.text.inverse, fontWeight: '600' as const },

  panel: {
    marginTop: spacing.xs,
    width: 260,
    maxHeight: 240,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...shadows.md,
  },
  panelScroll: { maxHeight: 220 },
  panelInfo: { ...(typography.caption as object), color: colors.text.muted, marginBottom: spacing.xs },

  failedRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs + 2,
    gap: 4,
  },
  failedText: { ...(typography.caption as object), color: colors.danger },
  failedActions: { flexDirection: 'row', gap: spacing.md },
  actionBtn: { paddingVertical: 2 },
  retryText: { ...(typography.caption as object), color: colors.primary, fontWeight: '600' as const },
  discardText: { ...(typography.caption as object), color: colors.text.muted, fontWeight: '600' as const },
});
