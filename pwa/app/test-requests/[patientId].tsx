/**
 * Test/scan requests screen. Patients (viewing their own id) see all requests and can
 * submit PENDING ones by uploading a document (reuses DocumentPicker from the Documents
 * feature — one upload path, not two). Staff/admin have the same create/edit/cancel
 * rights on any patient's requests as the CRM.
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
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { DocumentPicker } from '../../components/DocumentPicker';
import { useAuth } from '../../context/auth';
import { getTestRequests, submitTestRequest, createTestRequest, updateTestRequest, type TestRequest } from '../../api/testRequests';

const STATUS_KEY: Record<TestRequest['status'], string> = {
  PENDING: 'testRequests.status.pending',
  SUBMITTED: 'testRequests.status.submitted',
  CANCELLED: 'testRequests.status.cancelled',
};

const STATUS_COLOR: Record<TestRequest['status'], string> = {
  PENDING: colors.primary,
  SUBMITTED: colors.success,
  CANCELLED: colors.danger,
};

function isOverdue(req: TestRequest): boolean {
  return req.status === 'PENDING' && new Date(req.dueDate).getTime() < Date.now();
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TestRequestsScreen() {
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;
  const isStaff = user?.role !== 'PATIENT';

  const [testRequests, setTestRequests] = useState<TestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await getTestRequests(pid);
      setTestRequests(data.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openCreateForm() {
    setEditingId(null);
    setName('');
    setInstructions('');
    setDueDate('');
    setShowForm(true);
  }

  function openEditForm(item: TestRequest) {
    setEditingId(item.id);
    setName(item.name);
    setInstructions(item.instructions ?? '');
    setDueDate(item.dueDate.slice(0, 10));
    setShowForm(true);
  }

  async function handleSaveForm() {
    if (!name.trim() || !dueDate) {
      Alert.alert(t('testRequests.missingInfoTitle'), t('testRequests.missingInfoBody'));
      return;
    }
    setSaving(true);
    try {
      if (editingId !== null) {
        const updated = await updateTestRequest(pid, editingId, {
          name: name.trim(),
          instructions: instructions.trim() || null,
          dueDate,
        });
        setTestRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createTestRequest(pid, {
          name: name.trim(),
          instructions: instructions.trim() || null,
          dueDate,
        });
        setTestRequests((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      Alert.alert(t('testRequests.saveFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    } finally {
      setSaving(false);
    }
  }

  function handleCancelRequest(item: TestRequest) {
    Alert.alert(t('testRequests.cancelConfirmTitle'), item.name, [
      { text: t('appointments.neverMind'), style: 'cancel' },
      {
        text: t('testRequests.cancelRequestAction'),
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await updateTestRequest(pid, item.id, { status: 'CANCELLED' });
            setTestRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          } catch (e) {
            Alert.alert(t('testRequests.cancelFailed'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
          }
        },
      },
    ]);
  }

  async function handleUploaded(requestId: number, documentId: number) {
    try {
      const updated = await submitTestRequest(pid, requestId, documentId);
      setTestRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSubmittingId(null);
    } catch {
      // DocumentPicker already surfaced any upload error; leave the picker open on submit failure
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
        <Text style={styles.title}>{t('testRequests.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={testRequests}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          isStaff ? (
            <View>
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.addBtn, showForm && styles.addBtnActive]}
                  onPress={() => (showForm ? setShowForm(false) : openCreateForm())}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.addBtnText, showForm && styles.addBtnTextActive]}>
                    {showForm ? '✕' : t('testRequests.requestTestScan')}
                  </Text>
                </TouchableOpacity>
              </View>

              {showForm && (
                <Card style={styles.formCard}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('testRequests.nameLabel')}</Text>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder={t('testRequests.namePlaceholder')}
                      placeholderTextColor={colors.text.muted}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('testRequests.instructionsOptional')}</Text>
                    <TextInput
                      style={styles.input}
                      value={instructions}
                      onChangeText={setInstructions}
                      placeholder={t('testRequests.instructionsPlaceholder')}
                      placeholderTextColor={colors.text.muted}
                    />
                  </View>
                  <DateField label={t('testRequests.dueDate')} value={dueDate} onChange={setDueDate} />
                  <Button
                    label={saving ? t('appointments.saving') : editingId !== null ? t('appointments.saveChanges') : t('testRequests.requestTestScanBtn')}
                    onPress={handleSaveForm}
                    loading={saving}
                  />
                </Card>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !showForm ? (
            <EmptyState
              icon="🧪"
              title={t('testRequests.noRequestsTitle')}
              subtitle={isOwnPatient ? t('testRequests.noRequestsPatientSubtitle') : t('testRequests.noRequestsStaffSubtitle')}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const overdue = isOverdue(item);
          return (
            <Card style={styles.reqCard}>
              <View style={styles.reqRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqName}>{item.name}</Text>
                  <Text style={styles.reqMeta}>
                    {t('testRequests.due', { date: formatDate(item.dueDate, t('language.locale')) })}{item.instructions ? ` · ${item.instructions}` : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${overdue ? colors.danger : STATUS_COLOR[item.status]}1a` }]}>
                  <Text style={[styles.badgeText, { color: overdue ? colors.danger : STATUS_COLOR[item.status] }]}>
                    {overdue ? t('touchBase.overdue') : t(STATUS_KEY[item.status])}
                  </Text>
                </View>
              </View>

              {isOwnPatient && item.status === 'PENDING' && (
                submittingId === item.id ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <DocumentPicker
                      patientId={pid}
                      onUploaded={(doc) => handleUploaded(item.id, doc.id)}
                    />
                    <TouchableOpacity onPress={() => setSubmittingId(null)} style={{ marginTop: spacing.xs }}>
                      <Text style={styles.actionLink}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.submitBtn} onPress={() => setSubmittingId(item.id)} activeOpacity={0.8}>
                    <Text style={styles.submitBtnText}>{t('testRequests.submit')}</Text>
                  </TouchableOpacity>
                )
              )}

              {isStaff && item.status === 'PENDING' && (
                <View style={styles.aptActions}>
                  <TouchableOpacity onPress={() => openEditForm(item)}>
                    <Text style={[styles.actionLink, { color: colors.primary }]}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleCancelRequest(item)}>
                    <Text style={[styles.actionLink, { color: colors.danger }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
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
  reqCard: { gap: spacing.sm, ...shadows.sm },
  reqRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  reqName: { ...typography.h4, color: colors.text.primary },
  reqMeta: { ...typography.body2, color: colors.text.muted, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { ...typography.caption, fontWeight: '700' as const, textTransform: 'uppercase' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 4,
    alignItems: 'center',
  },
  submitBtnText: { ...typography.label, color: colors.text.inverse, fontWeight: '600' as const },
  actionLink: { ...typography.label, color: colors.text.muted },

  navRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  addBtn: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addBtnActive: { backgroundColor: colors.bg.subtle, borderColor: colors.border },
  addBtnText: { ...typography.label, color: colors.primary, fontWeight: '600' as const },
  addBtnTextActive: { color: colors.text.secondary },
  formCard: { gap: spacing.md, marginBottom: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.text.secondary },
  input: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.text.primary,
  },
  aptActions: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
});
