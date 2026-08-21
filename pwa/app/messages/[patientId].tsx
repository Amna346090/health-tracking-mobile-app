/**
 * Messages inbox screen — two-way conversation between a patient and their care team.
 * Both the patient (viewing their own id) and staff/admin (viewing any patient's id)
 * can read and reply from here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/auth';
import { getMessages, markMessageRead, sendMessage, type Message } from '../../api/messages';
import { onPushEvent } from '../../lib/pushEvents';

function dayLabel(iso: string, t: TFunction): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return t('messages.today');
  if (sameDay(d, yesterday)) return t('messages.yesterday');
  return d.toLocaleDateString(t('language.locale'), {
    month: 'long', day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function timeLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;
  const canSend = isOwnPatient || user?.role !== 'PATIENT';
  const listRef = useRef<FlatList<Message>>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await getMessages(pid);
      setMessages([...data].reverse());
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid]);

  // Scrolls to the newest message. Fires several times over half a second —
  // a full list refetch can take a moment to lay out, so one attempt isn't
  // enough to guarantee the list has actually finished growing yet.
  const scrollToBottom = useCallback(() => {
    for (const delay of [0, 50, 150, 350]) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), delay);
    }
  }, []);

  // Opening the screen (manually or via a notification tap) should always land on the
  // newest message, not wherever the list's initial layout happened to settle.
  useFocusEffect(useCallback(() => { load().then(scrollToBottom); }, [load, scrollToBottom]));

  // Live refresh: a reply arrives from the other party while this chat is open.
  useEffect(() => onPushEvent(`message:${pid}`, () => {
    load().then(scrollToBottom);
  }), [pid, load, scrollToBottom]);

  async function handlePress(message: Message) {
    if (message.sender.id === user?.id || message.readAt) return;
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
      scrollToBottom();
    } catch (e) {
      Alert.alert(t('messages.sendFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
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
            <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('patientDashboard.messages')}</Text>
          <View style={{ width: 50 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState icon="💬" title={t('messages.noneYetTitle')} subtitle={t('messages.noneYetSubtitle')} />
          }
          renderItem={({ item, index }) => {
            const olderNeighbor = messages[index - 1];
            const showDivider = !olderNeighbor || dayLabel(olderNeighbor.createdAt, t) !== dayLabel(item.createdAt, t);
            const isMine = item.sender.id === user?.id;
            return (
              <View>
                {showDivider && (
                  <View style={styles.dayDivider}><Text style={styles.dayDividerText}>{dayLabel(item.createdAt, t)}</Text></View>
                )}
                <TouchableOpacity
                  activeOpacity={item.sender.id !== user?.id && !item.readAt ? 0.7 : 1}
                  onPress={() => handlePress(item)}
                  style={isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs}
                >
                  <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                    <View style={styles.msgHeader}>
                      <Text style={[styles.msgSender, isMine && styles.msgSenderMine]}>
                        {isMine ? t('messages.you') : `${item.sender.firstName} ${item.sender.lastName}`}
                      </Text>
                      {!item.readAt && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={[styles.msgBody, isMine && styles.msgBodyMine]}>{item.body}</Text>
                    <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{timeLabel(item.createdAt, t('language.locale'))}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />

        {canSend && (
          <View style={styles.composeRow}>
            <TextInput
              style={styles.composeInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('messages.typeMessage')}
              placeholderTextColor={colors.text.muted}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.sendBtnText}>{t('messages.send')}</Text>}
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
