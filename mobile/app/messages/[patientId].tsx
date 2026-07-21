/**
 * Messages inbox screen — patients read touchpoints sent by staff.
 * Staff/admin viewing another patient's id get the same list, read-only (no mark-as-read).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { useAuth } from '../../context/auth';
import { getMessages, markMessageRead, type Message } from '../../api/messages';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function MessagesScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;

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
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="💬" title="No messages yet" subtitle="Your care team hasn't sent any messages yet." />
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={isOwnPatient && !item.readAt ? 0.7 : 1} onPress={() => handlePress(item)}>
            <Card style={styles.msgCard}>
              <View style={styles.msgHeader}>
                <Text style={styles.msgSender}>{item.sender.firstName} {item.sender.lastName}</Text>
                {!item.readAt && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.msgBody}>{item.body}</Text>
              <Text style={styles.msgTime}>{formatWhen(item.createdAt)}</Text>
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
  msgCard: { gap: 4, ...shadows.sm },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  msgSender: { ...typography.label, color: colors.text.secondary, fontWeight: '600' as const },
  unreadDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary },
  msgBody: { ...typography.body1, color: colors.text.primary },
  msgTime: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
});
