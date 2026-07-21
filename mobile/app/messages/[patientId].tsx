/**
 * Messages inbox screen — patients read touchpoints sent by staff.
 * Staff/admin viewing another patient's id get the same list, read-only (no mark-as-read).
 * Rendered as an inverted chat feed (newest at bottom) with day dividers, so long
 * touch-base histories stay easy to scan instead of one long undifferentiated list.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/auth';
import { getMessages, markMessageRead, type Message } from '../../api/messages';

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function MessagesScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;

  // Kept newest-first (matches the API order) to pair with FlatList's `inverted` prop.
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await getMessages(pid));
    } catch {
      // keep state
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { load(); }, [load]);

  async function handlePress(message: Message) {
    if (!isOwnPatient || message.readAt) return;
    try {
      const updated = await markMessageRead(pid, message.id);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      // non-fatal — leave as unread
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
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="💬" title="No messages yet" subtitle="Your care team hasn't sent any messages yet." />
        }
        renderItem={({ item, index }) => {
          const olderNeighbor = messages[index + 1];
          const showDivider = !olderNeighbor || dayLabel(olderNeighbor.createdAt) !== dayLabel(item.createdAt);
          return (
            // FlatList's `inverted` flips the whole scroll content upside down, so each
            // cell needs a counter-flip to render right-side-up again.
            <View style={{ transform: [{ scaleY: -1 }] }}>
              {showDivider && (
                <View style={styles.dayDivider}><Text style={styles.dayDividerText}>{dayLabel(item.createdAt)}</Text></View>
              )}
              <TouchableOpacity activeOpacity={isOwnPatient && !item.readAt ? 0.7 : 1} onPress={() => handlePress(item)}>
                <View style={styles.bubble}>
                  <View style={styles.msgHeader}>
                    <Text style={styles.msgSender}>{item.sender.firstName} {item.sender.lastName}</Text>
                    {!item.readAt && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.msgBody}>{item.body}</Text>
                  <Text style={styles.msgTime}>{timeLabel(item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            </View>
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
  dayDivider: { alignItems: 'center', marginVertical: spacing.sm },
  dayDividerText: {
    ...typography.caption,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    color: colors.text.muted,
    backgroundColor: colors.bg.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  bubble: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    padding: spacing.md,
    maxWidth: '85%',
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  msgSender: { ...typography.caption, color: colors.warning, fontWeight: '700' as const },
  unreadDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.primary },
  msgBody: { ...typography.body1, color: colors.text.primary },
  msgTime: { ...typography.caption, color: colors.text.muted, marginTop: 4 },
});
