/**
 * Messages inbox screen — two-way conversation between a patient and their care team.
 * Patients (viewing their own id) can read and reply. Staff/admin (viewing another
 * patient's id) get the same thread, read-only (no compose box, no mark-as-read).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/auth';
import { getMessages, markMessageRead, sendMessage, type Message } from '../../api/messages';

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
  const listRef = useRef<FlatList<Message>>(null);

  // Oldest first, top to bottom — a plain chronological list, same as the CRM's thread view.
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMessages(pid);
      setMessages([...data].reverse());
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

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const message = await sendMessage(pid, body);
      setMessages((prev) => [...prev, message]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      Alert.alert('Could not send message', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Messages</Text>
          <View style={{ width: 50 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState icon="💬" title="No messages yet" subtitle="Your care team hasn't sent any messages yet." />
          }
          renderItem={({ item, index }) => {
            const olderNeighbor = messages[index - 1];
            const showDivider = !olderNeighbor || dayLabel(olderNeighbor.createdAt) !== dayLabel(item.createdAt);
            const isMine = isOwnPatient && item.sender.role === 'PATIENT';
            return (
              <View>
                {showDivider && (
                  <View style={styles.dayDivider}><Text style={styles.dayDividerText}>{dayLabel(item.createdAt)}</Text></View>
                )}
                <TouchableOpacity
                  activeOpacity={isOwnPatient && !item.readAt ? 0.7 : 1}
                  onPress={() => handlePress(item)}
                  style={isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs}
                >
                  <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                    <View style={styles.msgHeader}>
                      <Text style={[styles.msgSender, isMine && styles.msgSenderMine]}>
                        {isMine ? 'You' : `${item.sender.firstName} ${item.sender.lastName}`}
                      </Text>
                      {!item.readAt && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={[styles.msgBody, isMine && styles.msgBodyMine]}>{item.body}</Text>
                    <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{timeLabel(item.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />

        {isOwnPatient && (
          <View style={styles.composeRow}>
            <TextInput
              style={styles.composeInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={colors.text.muted}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.sendBtnText}>Send</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  flex: { flex: 1 },
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
  bubbleWrapTheirs: { alignItems: 'flex-start' },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubble: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    padding: spacing.md,
    maxWidth: '85%',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: 4,
  },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  msgSender: { ...typography.caption, color: colors.warning, fontWeight: '700' as const },
  msgSenderMine: { color: 'rgba(255,255,255,0.8)' },
  unreadDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.primary },
  msgBody: { ...typography.body1, color: colors.text.primary },
  msgBodyMine: { color: colors.text.inverse },
  msgTime: { ...typography.caption, color: colors.text.muted, marginTop: 4 },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },

  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg.app,
  },
  composeInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.text.primary,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { ...typography.body2, fontWeight: '600' as const, color: colors.text.inverse },
});
