/**
 * Documents screen. Patients can upload, edit, and delete their own documents.
 * Staff/admin have the same full upload/edit/delete rights on any patient's
 * documents, matching the CRM.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
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
import * as ExpoDocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DocumentPicker } from '../../components/DocumentPicker';
import { useAuth } from '../../context/auth';
import { getDocuments, updateDocument, deleteDocument, type Document } from '../../api/documents';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileTypeLabel(fileType: string): string {
  if (fileType === 'application/pdf') return 'PDF';
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType === 'application/dicom') return 'DICOM';
  return fileType;
}

export default function DocumentsScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;
  const canManage = isOwnPatient || user?.role !== 'PATIENT';

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [editingItem, setEditingItem] = useState<Document | null>(null);
  const [editTag, setEditTag] = useState('');
  const [replacement, setReplacement] = useState<ExpoDocumentPicker.DocumentPickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      setDocuments(await getDocuments(pid));
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openEdit(item: Document) {
    setEditingItem(item);
    setEditTag(item.tag ?? '');
    setReplacement(null);
  }

  async function pickReplacement() {
    const result = await ExpoDocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled) setReplacement(result.assets[0]);
  }

  async function handleSaveEdit() {
    if (!editingItem) return;
    setSaving(true);
    try {
      const updated = await updateDocument(editingItem.id, {
        patientId: pid,
        uri: replacement?.uri,
        mimeType: replacement?.mimeType ?? undefined,
        filename: replacement?.name,
        tag: editTag.trim() || null,
      });
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setEditingItem(null);
    } catch (e) {
      Alert.alert('Could not save changes', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: Document) {
    Alert.alert('Delete document?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await deleteDocument(item.id);
            setDocuments((prev) => prev.filter((d) => d.id !== item.id));
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
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
      <Text style={styles.editTitle}>Edit document</Text>
      <TouchableOpacity style={styles.replaceBtn} onPress={pickReplacement} disabled={saving}>
        <Feather name="upload" size={14} color={colors.text.secondary} />
        <Text style={styles.replaceBtnText} numberOfLines={1}>
          {replacement ? replacement.name : 'Replace file (optional)'}
        </Text>
      </TouchableOpacity>
      <TextInput
        style={styles.tagInput}
        value={editTag}
        onChangeText={setEditTag}
        placeholder="Tag (e.g. Lab Report)"
        placeholderTextColor={colors.text.muted}
      />
      <View style={styles.editActions}>
        <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.cancelBtn} disabled={saving}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Button label={saving ? 'Saving…' : 'Save changes'} onPress={handleSaveEdit} loading={saving} />
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Documents</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            {canManage && (
              <DocumentPicker
                patientId={pid}
                onUploaded={(doc) => setDocuments((prev) => [doc, ...prev])}
              />
            )}
            {EditForm}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="📄"
            title="No documents yet"
            subtitle={canManage ? 'Tap "Upload Document" to add a scan or report.' : 'This patient has no documents yet.'}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.docCard}>
            <TouchableOpacity onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
              <View style={styles.docRow}>
                <Feather name="file-text" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTag}>{item.tag ?? 'Untagged document'}</Text>
                  <Text style={styles.docMeta}>{fileTypeLabel(item.fileType)} · {formatWhen(item.uploadedAt)}</Text>
                </View>
              </View>
            </TouchableOpacity>
            {canManage && (
              <View style={styles.docActions}>
                <TouchableOpacity onPress={() => openEdit(item)}>
                  <Text style={styles.actionLink}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} disabled={deletingId === item.id}>
                  <Text style={[styles.actionLink, { color: colors.danger }]}>
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
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
  docCard: { gap: spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docTag: { ...typography.h4, color: colors.text.primary },
  docMeta: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  docActions: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionLink: { ...typography.label, color: colors.primary, fontWeight: '600' as const },

  editCard: { gap: spacing.sm },
  editTitle: { ...typography.h4, color: colors.text.primary },
  replaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.input,
  },
  replaceBtnText: { ...typography.label, color: colors.text.secondary, flex: 1 },
  tagInput: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.text.primary,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  cancelBtnText: { ...typography.label, color: colors.text.secondary },
});
