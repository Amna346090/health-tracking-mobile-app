/**
 * Notes screen. Staff/admin can add, edit, and delete notes on any patient.
 * Patients (viewing their own id) get a read-only view — visible but not editable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/auth';
import { getNotes, createNote, updateNote, deleteNote, type Note } from '../../api/notes';

function formatWhen(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function NotesScreen() {
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const canEdit = user?.role !== 'PATIENT';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [newBody, setNewBody] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingItem, setEditingItem] = useState<Note | null>(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      setNotes(await getNotes(pid));
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAdd() {
    if (!newBody.trim()) return;
    setAdding(true);
    try {
      const note = await createNote(pid, newBody.trim());
      setNotes((prev) => [note, ...prev]);
      setNewBody('');
    } catch (e) {
      Alert.alert(t('notes.addFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    } finally {
      setAdding(false);
    }
  }

  function openEdit(item: Note) {
    setEditingItem(item);
    setEditBody(item.body);
  }

  async function handleSaveEdit() {
    if (!editingItem || !editBody.trim()) return;
    setSaving(true);
    try {
      const updated = await updateNote(pid, editingItem.id, editBody.trim());
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditingItem(null);
    } catch (e) {
      Alert.alert(t('notes.saveChangesFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: Note) {
    Alert.alert(t('notes.deleteConfirmTitle'), t('notes.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await deleteNote(pid, item.id);
            setNotes((prev) => prev.filter((n) => n.id !== item.id));
          } catch (e) {
            Alert.alert(t('notes.deleteFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const EditForm = editingItem && (
    <Card style={styles.editCard}>
      <Text style={styles.editTitle}>{t('notes.editNote')}</Text>
      <TextInput
        style={styles.bodyInput}
        value={editBody}
        onChangeText={setEditBody}
        placeholder={t('notes.notePlaceholder')}
        placeholderTextColor={colors.text.muted}
        multiline
      />
      <View style={styles.editActions}>
        <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.cancelBtn} disabled={saving}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Button label={saving ? t('appointments.saving') : t('appointments.saveChanges')} onPress={handleSaveEdit} loading={saving} />
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('healthLog.notes')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          canEdit ? (
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <Card style={styles.addCard}>
                <TextInput
                  style={styles.bodyInput}
                  value={newBody}
                  onChangeText={setNewBody}
                  placeholder={t('notes.addPlaceholder')}
                  placeholderTextColor={colors.text.muted}
                  multiline
                />
                <Button label={adding ? t('notes.adding') : t('notes.addNote')} onPress={handleAdd} loading={adding} disabled={!newBody.trim()} />
              </Card>
              {EditForm}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState icon="📝" title={t('notes.noneYetTitle')} subtitle={canEdit ? t('notes.staffOnlySubtitle') : t('notes.patientSubtitle')} />
        }
        renderItem={({ item }) => (
          <Card style={styles.noteCard}>
            <View style={styles.noteRow}>
              <Feather name="file-text" size={18} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noteBody}>{item.body}</Text>
                <Text style={styles.noteMeta}>
                  {item.author.firstName} {item.author.lastName} · {formatWhen(item.createdAt, t('language.locale'))}
                  {item.updatedAt !== item.createdAt ? t('notes.editedSuffix') : ''}
                </Text>
              </View>
            </View>
            {canEdit && (
              <View style={styles.noteActions}>
                <TouchableOpacity onPress={() => openEdit(item)}>
                  <Text style={styles.actionLink}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} disabled={deletingId === item.id}>
                  <Text style={[styles.actionLink, { color: colors.danger }]}>
                    {deletingId === item.id ? t('notifications.deleting') : t('common.delete')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
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

  addCard: { gap: spacing.sm },
  noteCard: { gap: spacing.sm },
  noteRow: { flexDirection: 'row', gap: spacing.sm },
  noteBody: { ...typography.body2, color: colors.text.primary },
  noteMeta: { ...typography.caption, color: colors.text.muted, marginTop: 4 },
  noteActions: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionLink: { ...typography.label, color: colors.primary, fontWeight: '600' as const },

  editCard: { gap: spacing.sm },
  editTitle: { ...typography.h4, color: colors.text.primary },
  bodyInput: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 72,
    textAlignVertical: 'top',
    ...typography.body2,
    color: colors.text.primary,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  cancelBtnText: { ...typography.label, color: colors.text.secondary },
});
