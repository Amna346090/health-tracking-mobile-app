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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

function formatWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/**
 * Notification title/body are baked into English by the backend at creation time (it doesn't
 * know the viewer's language). For the known system-generated types, `params` carries the raw
 * values so we can rebuild the sentence in the current language instead; anything without a
 * recognized type/params (older rows, or unmapped types) just falls back to the stored text.
 */
function renderNotification(item: Notification, t: TFunction): { title: string; body: string } {
  const p = item.params;

  switch (item.type) {
    case 'TOUCH_BASE_DUE': {
      const title = t('notificationTypes.touchBase.title');
      if (p && typeof p.patientName === 'string') {
        const name = p.patientName;
        const daysSince = typeof p.daysSince === 'number' ? p.daysSince : null;
        const body = daysSince !== null
          ? t('notificationTypes.touchBase.bodyWithDays', { name, count: daysSince })
          : t('notificationTypes.touchBase.bodyNever', { name });
        return { title, body };
      }
      return { title, body: item.body };
    }
    case 'MEDICATION_REMINDER': {
      const title = t('notificationTypes.medication.title');
      if (p && typeof p.medicationName === 'string') {
        const name = p.medicationName;
        const dosage = typeof p.dosage === 'string' ? p.dosage : null;
        const body = dosage
          ? t('notificationTypes.medication.bodyWithDosage', { name, dosage })
          : t('notificationTypes.medication.bodyNoDosage', { name });
        return { title, body };
      }
      return { title, body: item.body };
    }
    case 'APPOINTMENT_REMINDER': {
      const title = t('notificationTypes.appointment.title');
      if (p && typeof p.scheduledFor === 'string') {
        const when = formatWhen(p.scheduledFor, t('language.locale'));
        const reason = typeof p.reason === 'string' ? p.reason : null;
        const body = reason
          ? t('notificationTypes.appointment.bodyWithReason', { when, reason })
          : t('notificationTypes.appointment.bodyNoReason', { when });
        return { title, body };
      }
      return { title, body: item.body };
    }
    case 'TEST_REQUEST_REMINDER': {
      const title = t('notificationTypes.testScan.title');
      if (p && typeof p.testName === 'string' && typeof p.stage === 'string') {
        const name = p.testName;
        if (p.stage === 'in2Days') return { title, body: t('notificationTypes.testScan.in2Days', { name }) };
        if (p.stage === 'dueToday') return { title, body: t('notificationTypes.testScan.dueToday', { name }) };
        if (p.stage === 'overdue' && typeof p.daysOverdue === 'number') {
          return { title, body: t('notificationTypes.testScan.overdue', { name, count: p.daysOverdue }) };
        }
      }
      return { title, body: item.body };
    }
    case 'NEW_MESSAGE': {
      const title = item.title === 'New patient message'
        ? t('notificationTypes.newPatientMessage.title')
        : t('notificationTypes.newMessage.title');
      return { title, body: item.body };
    }
    default:
      return { title: item.title, body: item.body };
  }
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
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
          <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('dashboard.notifications')}</Text>
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
              <Text style={styles.markAllText}>{markingAll ? t('notifications.marking') : t('notifications.markAllAsRead')}</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="🔔" title={t('notifications.noneYetTitle')} subtitle={t('notifications.noneYetSubtitle')} />}
        renderItem={({ item }) => {
          const { title, body } = renderNotification(item, t);
          return (
          <TouchableOpacity onPress={() => handlePress(item)} activeOpacity={0.7}>
            <Card style={[styles.notifCard, !item.readAt && styles.notifCardUnread]}>
              <View style={styles.notifRow}>
                <Feather name="bell" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle}>{title}</Text>
                  <Text style={styles.notifBody}>{body}</Text>
                  <Text style={styles.notifMeta}>{formatWhen(item.createdAt, t('language.locale'))}</Text>
                </View>
              </View>
              <View style={styles.notifActions}>
                {!item.readAt && (
                  <TouchableOpacity onPress={() => markOneRead(item)}>
                    <Text style={styles.actionLink}>{t('notifications.markRead')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(item)} disabled={deletingId === item.id}>
                  <Text style={[styles.actionLink, { color: colors.danger }]}>
                    {deletingId === item.id ? t('notifications.deleting') : t('common.delete')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          </TouchableOpacity>
          );
        }}
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
