/**
 * Notifications inbox — shared by admin and patients. Tapping a notification routes
 * to the relevant screen based on its type (admin's touch-base alerts still open the
 * staff patient-dashboard; a patient's own message/appointment/test-request alerts
 * open their own thread/list instead). Mirrors web/src/pages/NotificationsPage.tsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { EmptyState } from '../components/EmptyState';
import { Card } from '../components/Card';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type Notification,
} from '../api/notifications';
import { onPushEvent } from '../lib/pushEvents';

const TYPE_ROUTE: Record<string, (patientId: number) => string> = {
  NEW_MESSAGE: (id) => `/messages/${id}`,
  APPOINTMENT_REMINDER: (id) => `/appointments/${id}`,
  TEST_REQUEST_REMINDER: (id) => `/test-requests/${id}`,
  MEDICATION_REMINDER: () => `/(tabs)`,
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      setNotifications(await getNotifications());
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live refresh: a new notification arrives while this list is open.
  useEffect(() => onPushEvent('notification', load), [load]);

  async function markOneRead(n: Notification) {
    if (n.readAt) return;
    try {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    } catch {
      // non-fatal
    }
  }

  async function handlePress(n: Notification) {
    await markOneRead(n);
    if (!n.patientId) return;
    const routeFor = TYPE_ROUTE[n.type];
    const path = routeFor ? routeFor(n.patientId) : `/patient-dashboard/${n.patientId}`;
    router.push(path as Parameters<typeof router.push>[0]);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })));
    } catch {
      // non-fatal
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDelete(n: Notification) {
    setDeletingId(n.id);
    try {
      await deleteNotification(n.id);
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    } catch {
      // non-fatal
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          unreadCount > 0 ? (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead} disabled={markingAll}>
              <Feather name="check-circle" size={13} color={colors.primary} />
              <Text style={styles.markAllText}>{markingAll ? 'Marking…' : 'Mark all as read'}</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="🔔" title="No notifications yet" subtitle="You're all caught up." />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handlePress(item)} activeOpacity={0.7}>
            <Card style={[styles.notifCard, !item.readAt && styles.notifCardUnread]}>
              <View style={styles.notifRow}>
                <Feather name="bell" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifBody}>{item.body}</Text>
                  <Text style={styles.notifMeta}>{formatWhen(item.createdAt)}</Text>
                </View>
              </View>
              <View style={styles.notifActions}>
                {!item.readAt && (
                  <TouchableOpacity onPress={() => markOneRead(item)}>
                    <Text style={styles.actionLink}>Mark read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(item)} disabled={deletingId === item.id}>
                  <Text style={[styles.actionLink, { color: colors.danger }]}>
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backText: { ...typography.body1, color: colors.primary },
  title: { ...typography.h3, color: colors.text.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },

  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  markAllText: { ...typography.label, color: colors.primary, fontWeight: '600' as const },

  notifCard: { gap: spacing.sm },
  notifCardUnread: { backgroundColor: colors.primaryBg },
  notifRow: { flexDirection: 'row', gap: spacing.sm },
  notifTitle: { ...typography.h4, color: colors.text.primary },
  notifBody: { ...typography.body2, color: colors.text.secondary, marginTop: 2 },
  notifMeta: { ...typography.caption, color: colors.text.muted, marginTop: 4 },
  notifActions: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionLink: { ...typography.label, color: colors.primary, fontWeight: '600' as const },
});
