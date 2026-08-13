import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { getTimeline, type TimelineEvent } from '../../api/timeline';
import { FEELING_EMOJI } from '../../components/FeelingPicker';
import type { FeelingStatus } from '../../api/healthLog';

const PAGE = 30;

// ─── Date grouping helpers ────────────────────────────────────────────────────

function dateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── Event card ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  TAKEN:   colors.success   ?? '#22c55e',
  MISSED:  colors.danger    ?? '#ef4444',
  SKIPPED: colors.warning   ?? '#f59e0b',
};

const STATUS_ICON: Record<string, string> = {
  TAKEN: '✅', MISSED: '❌', SKIPPED: '⏭',
};

function EventCard({ event, onPhotoPress }: { event: TimelineEvent; onPhotoPress?: (id: number) => void }) {
  if (event.type === 'MEDICATION_LOG') {
    const color = STATUS_COLOR[event.status] ?? colors.text.secondary;
    return (
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
          <Text style={styles.iconText}>{STATUS_ICON[event.status] ?? '💊'}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{event.medication.name}</Text>
          <Text style={[styles.cardSub, { color }]}>
            {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
            {event.medication.dosage ? ` · ${event.medication.dosage}` : ''}
          </Text>
          {event.notes ? <Text style={styles.cardNote}>{event.notes}</Text> : null}
        </View>
        <Text style={styles.cardTime}>{timeLabel(event.timestamp)}</Text>
      </View>
    );
  }

  if (event.type === 'HEALTH_LOG') {
    const emoji = event.feeling ? FEELING_EMOJI[event.feeling as FeelingStatus] : null;
    return (
      <View style={styles.card}>
        <View style={[styles.iconBox, { backgroundColor: colors.primaryBg }]}>
          <Text style={styles.iconText}>📋</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Health log</Text>
          <Text style={styles.cardSub}>
            {[
              event.weight ? `${event.weight} kg` : null,
              event.height ? `${event.height} cm` : null,
              emoji,
            ].filter(Boolean).join(' · ') || 'Notes only'}
          </Text>
          {event.createdBy.role !== 'PATIENT' && (
            <Text style={styles.staffTag}>Staff entry</Text>
          )}
        </View>
        <Text style={styles.cardTime}>{timeLabel(event.timestamp)}</Text>
      </View>
    );
  }

  // PHOTO
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPhotoPress?.(event.id)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: event.url }} style={styles.photoThumb} resizeMode="cover" />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>Photo uploaded</Text>
        <Text style={styles.cardSub}>{event.caption ?? 'No caption'}</Text>
      </View>
      <Text style={styles.cardTime}>{timeLabel(event.timestamp)}</Text>
    </TouchableOpacity>
  );
}

// ─── Section header (date group) ─────────────────────────────────────────────

function DateHeader({ label }: { label: string }) {
  return (
    <View style={styles.dateHeader}>
      <Text style={styles.dateHeaderText}>{label}</Text>
    </View>
  );
}

// ─── Grouped list item ────────────────────────────────────────────────────────

type ListItem =
  | { kind: 'header'; label: string; key: string }
  | { kind: 'event';  event: TimelineEvent; key: string };

function buildList(events: TimelineEvent[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDay = '';
  for (const event of events) {
    const day = event.timestamp.slice(0, 10);
    if (day !== lastDay) {
      lastDay = day;
      items.push({ kind: 'header', label: dateLabel(event.timestamp), key: `hdr-${day}` });
    }
    items.push({ kind: 'event', event, key: `${event.type}-${event.id}` });
  }
  return items;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const pid = Number(patientId);

  const [events,      setEvents]      = useState<TimelineEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async (reset = false) => {
    const before = reset ? undefined : events[events.length - 1]?.timestamp;
    if (reset) { if (!hasLoadedRef.current) setLoading(true); } else { setLoadingMore(true); }
    try {
      const data = await getTimeline(pid, { limit: PAGE, before });
      setEvents((prev) => reset ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE);
    } catch {
      // keep state
    } finally {
      setLoading(false);
      setLoadingMore(false);
      hasLoadedRef.current = true;
    }
  }, [pid, events]);

  useFocusEffect(useCallback(() => { load(true); }, [pid]));

  const listItems = buildList(events);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Activity History</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          onEndReached={() => { if (!loadingMore && hasMore) load(); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <View style={styles.footer}><ActivityIndicator color={colors.primary} /></View>
              : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No activity yet.</Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'header'
              ? <DateHeader label={item.label} />
              : (
                <EventCard
                  event={item.event}
                  onPhotoPress={(id) => router.push(`/photo/${id}`)}
                />
              )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: { ...(typography.body1 as object), color: colors.primary },
  title:    { ...(typography.h4 as object), color: colors.text.primary },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { ...(typography.body2 as object), color: colors.text.muted },

  dateHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  dateHeaderText: {
    ...(typography.label as object),
    color: colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 18 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { ...(typography.body2 as object), fontWeight: '600' as const, color: colors.text.primary },
  cardSub:   { ...(typography.caption as object), color: colors.text.secondary },
  cardNote:  { ...(typography.caption as object), color: colors.text.muted },
  cardTime:  { ...(typography.caption as object), color: colors.text.muted, flexShrink: 0 },
  staffTag:  {
    ...(typography.caption as object),
    color: colors.warning,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start' as const,
  },
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
});
