/**
 * Staff/admin view of a specific patient's active peptide assignments — edit or delete
 * (deactivate) one. Patients manage their own peptides from the Peptides tab instead.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { TimeField } from '../../components/TimeField';
import { Input } from '../../components/Input';
import { downloadFile } from '../../api/client';
import { getAssignments, getOrders, prescriptionPdfPath } from '../../api/assignments';
import {
  listAssignmentsCached, mergeAssignmentsFromServer, updateAssignmentOffline, deactivateAssignmentOffline,
  listOrdersCached, mergeOrdersFromServer, createOrderOffline, deleteOrderOffline, isTempId,
  type OfflineAssignment as MedicationAssignment, type OfflineOrder as MedicationOrder,
} from '../../offline/entities/assignments';
import { sameList, sameListMap, byCreatedDesc } from '../../offline/util';
import { cache, onCacheChanged } from '../../offline/cache';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly'];

const FREQUENCY_LABEL_KEY: Record<string, string> = {
  'Once daily': 'medicationForm.frequencyOptions.onceDaily',
  'Twice daily': 'medicationForm.frequencyOptions.twiceDaily',
  'Three times daily': 'medicationForm.frequencyOptions.threeTimesDaily',
  'As needed': 'medicationForm.frequencyOptions.asNeeded',
  'Weekly': 'medicationForm.frequencyOptions.weekly',
};

function frequencyLabel(f: string, t: TFunction): string {
  return FREQUENCY_LABEL_KEY[f] ? t(FREQUENCY_LABEL_KEY[f]) : f;
}

const FREQUENCY_DEFAULT_COUNT: Record<string, number> = {
  'Once daily': 1,
  'Twice daily': 2,
  'Three times daily': 3,
  'As needed': 0,
  'Weekly': 1,
};

function formatOrderDate(iso: string, t: TFunction): string {
  return new Date(iso).toLocaleDateString(t('language.locale'), { month: 'short', day: 'numeric', year: 'numeric' });
}

function timesForCount(current: string[], count: number): string[] {
  if (count <= current.length) return current.slice(0, count);
  return [...current, ...Array(count - current.length).fill('08:00')];
}

export default function PatientPeptidesScreen() {
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const pidIsTemp = isTempId(patientId);
  const pid = pidIsTemp ? patientId : Number(patientId);

  const initialAssignments = () => cache.listSync<MedicationAssignment>('assignments').filter((a) => String(a.patientId) === String(pid));
  const [assignments, setAssignments] = useState<MedicationAssignment[]>(initialAssignments);
  const [loading, setLoading] = useState(() => initialAssignments().length === 0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<MedicationAssignment | null>(null);
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [times, setTimes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refillsAllowed, setRefillsAllowed] = useState('');

  const [orders, setOrders] = useState<Record<string, MedicationOrder[]>>({});
  const [orderFormFor, setOrderFormFor] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState('');
  const [orderDose, setOrderDose] = useState('');

  const hasLoadedRef = useRef(false);

  const byOrderDateDesc = (list: MedicationOrder[]) => [...list].sort((a, b) => b.date.localeCompare(a.date));

  // Local-only refresh — never hits the network. Reacting to a local change with a network
  // re-check would race that change's own request (e.g. it could return before a delete
  // reaches the server, still see the old row, and put it right back).
  const refreshFromCache = useCallback(async (): Promise<number> => {
    const cached = byCreatedDesc(await listAssignmentsCached(pid));
    setAssignments((prev) => (sameList(prev, cached) ? prev : cached));
    const cachedOrders = await Promise.all(cached.map((a) => listOrdersCached(a.id).then((o) => [a.id, byOrderDateDesc(o)] as const)));
    const cachedOrdersObj = Object.fromEntries(cachedOrders);
    setOrders((prev) => (sameListMap(prev, cachedOrdersObj) ? prev : cachedOrdersObj));
    if (cached.length > 0) setLoading(false);
    return cached.length;
  }, [pid]);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    await refreshFromCache();

    if (pidIsTemp) { setLoading(false); hasLoadedRef.current = true; return; }

    try {
      const data = await getAssignments(pid as number);
      const merged = byCreatedDesc(await mergeAssignmentsFromServer(pid, data));
      setAssignments((prev) => (sameList(prev, merged) ? prev : merged));
      const entries = await Promise.all(
        merged.map((a) => getOrders(pid as number, a.id as number)
          .then((o) => mergeOrdersFromServer(a.id, o))
          .then((o) => [a.id, byOrderDateDesc(o)] as const)),
      );
      const entriesObj = Object.fromEntries(entries);
      setOrders((prev) => (sameListMap(prev, entriesObj) ? prev : entriesObj));
    } catch {
      // offline or request failed — keep showing whatever was cached
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid, pidIsTemp, refreshFromCache]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onCacheChanged('assignments', () => refreshFromCache()), [refreshFromCache]);
  useEffect(() => onCacheChanged('medicationOrders', () => refreshFromCache()), [refreshFromCache]);

  function openEdit(item: MedicationAssignment) {
    setEditingItem(item);
    setFrequency(item.frequency ?? FREQUENCIES[0]);
    setTimes(item.timesOfDay.length ? item.timesOfDay : timesForCount([], FREQUENCY_DEFAULT_COUNT[item.frequency ?? FREQUENCIES[0]] ?? 0));
    setStartDate(item.startDate.slice(0, 10));
    setEndDate(item.endDate?.slice(0, 10) ?? '');
    setRefillsAllowed(item.refillsAllowed?.toString() ?? '');
  }

  function handleFrequencyChange(f: string) {
    setFrequency(f);
    setTimes((prev) => timesForCount(prev, FREQUENCY_DEFAULT_COUNT[f] ?? prev.length));
  }

  function updateTime(index: number, value: string) {
    setTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addTime() {
    setTimes((prev) => [...prev, '08:00']);
  }

  function removeTime(index: number) {
    setTimes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveEdit() {
    if (!editingItem) return;
    const parsedRefills = refillsAllowed.trim() ? parseInt(refillsAllowed.trim(), 10) : null;
    const validTimes = times.filter(Boolean);
    const updated = await updateAssignmentOffline(pid, editingItem.id, {
      frequency,
      timesPerDay: validTimes.length || undefined,
      timesOfDay: validTimes,
      startDate,
      endDate: endDate.trim() || null,
      refillsAllowed: parsedRefills !== null && !isNaN(parsedRefills) ? parsedRefills : null,
    });
    setAssignments((prev) => prev.map((a) => (String(a.id) === String(updated.id) ? updated : a)));
    setEditingItem(null);
  }

  async function handleDownloadPrescription(item: MedicationAssignment) {
    if (isTempId(item.id)) {
      Alert.alert(t('peptidesPatient.couldNotDownloadPrescription'), t('offlineSync.genericError'));
      return;
    }
    setDownloadingId(String(item.id));
    try {
      const path = prescriptionPdfPath(pid as number, item.id as number);
      const fileUri = await downloadFile(path, `prescription-${item.id}.pdf`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
    } catch (e) {
      Alert.alert(t('peptidesPatient.couldNotDownloadPrescription'), e instanceof Error ? e.message : t('common.pleaseTryAgain'));
    } finally {
      setDownloadingId(null);
    }
  }

  function openOrderForm(assignmentId: string) {
    setOrderFormFor(assignmentId);
    setOrderDate(new Date().toISOString().slice(0, 10));
    setOrderDose('');
  }

  // Shown immediately via the cache-change listener above — adding it here too would race
  // that listener and show it twice.
  async function handleSaveOrder(assignmentId: string) {
    if (!orderDate || !orderDose.trim()) return;
    await createOrderOffline(pid, assignmentId, { date: orderDate, dose: orderDose.trim() });
    setOrderFormFor(null);
  }

  async function handleDeleteOrder(assignmentId: string, order: MedicationOrder) {
    await deleteOrderOffline(pid, assignmentId, order.id);
    setOrders((prev) => ({ ...prev, [assignmentId]: (prev[assignmentId] ?? []).filter((o) => String(o.id) !== String(order.id)) }));
  }

  function handleDelete(item: MedicationAssignment) {
    Alert.alert(t('medicationDetail.deletePeptideTitle'), t('peptidesPatient.deleteConfirmBody', { name: item.medication.name }), [
      { text: t('appointments.neverMind'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deactivateAssignmentOffline(pid, item.id);
          setAssignments((prev) => prev.filter((a) => String(a.id) !== String(item.id)));
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
    <Card style={styles.formCard}>
      <Text style={styles.formTitle}>{t('peptidesPatient.editTitle', { name: editingItem.medication.name })}</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('peptidesPatient.frequencyFieldLabel')}</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, frequency === f && styles.chipSelected]}
              onPress={() => handleFrequencyChange(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>{frequencyLabel(f, t)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          {t('medicationForm.timesPerDay', { count: times.length })}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {times.map((time, i) => (
            <View key={i} style={styles.timeRow}>
              <View style={styles.flex}>
                <TimeField label={t('medicationForm.timeSlotLabel', { n: i + 1 })} value={time} onChange={(v) => updateTime(i, v)} />
              </View>
              <TouchableOpacity onPress={() => removeTime(i)} style={styles.removeTimeBtn} accessibilityLabel={t('medicationForm.removeTimeA11y')}>
                <Text style={styles.removeTimeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={addTime} style={styles.addTimeBtn} activeOpacity={0.7}>
            <Text style={styles.addTimeText}>{t('peptidesPatient.addTime')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <DateField label={t('peptidesPatient.startDateLabel')} value={startDate} onChange={setStartDate} />
        </View>
        <View style={styles.half}>
          <DateField label={t('peptidesPatient.endDateOptionalLabel')} value={endDate} onChange={setEndDate} />
        </View>
      </View>

      <View style={styles.formActions}>
        <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Button label={t('appointments.saveChanges')} onPress={handleSaveEdit} />
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
        <Text style={styles.title}>{t('peptidesPatient.title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={assignments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={EditForm}
        ListEmptyComponent={
          !editingItem ? (
            <EmptyState icon="💊" title={t('medications.noneAssignedTitle')} subtitle={t('peptidesPatient.assignFromDashboard')} />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.medCard}>
            <View style={styles.medRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{item.medication.name}</Text>
                {item.medication.dosage && <Text style={styles.medDosage}>{item.medication.dosage}</Text>}
                <Text style={styles.schedule}>
                  {item.frequency
                    ? [item.frequency, item.timesOfDay.join(', ')].filter(Boolean).join(' · ')
                    : t('medications.scheduleNotSet')}
                </Text>
              </View>
            </View>

            <View style={styles.ordersBlock}>
              <Text style={styles.ordersLabel}>{t('peptidesPatient.orderHistory')}</Text>
              {(orders[String(item.id)] ?? []).map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <Text style={styles.orderDate}>{formatOrderDate(order.date, t)}</Text>
                  <Text style={styles.orderDose}>{order.dose}</Text>
                  <TouchableOpacity onPress={() => handleDeleteOrder(String(item.id), order)}>
                    <Text style={styles.orderDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {(orders[String(item.id)] ?? []).length === 0 && orderFormFor !== String(item.id) && (
                <Text style={styles.ordersEmpty}>{t('peptidesPatient.noOrdersLoggedYet')}</Text>
              )}

              {orderFormFor === String(item.id) ? (
                <View style={styles.orderForm}>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <DateField label={t('appointments.date')} value={orderDate} onChange={setOrderDate} />
                    </View>
                    <View style={styles.half}>
                      <Input label={t('peptidesPatient.doseLabel')} value={orderDose} onChangeText={setOrderDose} placeholder={t('peptidesPatient.dosePlaceholder')} />
                    </View>
                  </View>
                  <View style={styles.formActions}>
                    <TouchableOpacity onPress={() => setOrderFormFor(null)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Button label={t('peptidesPatient.saveOrder')} onPress={() => handleSaveOrder(String(item.id))} />
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => openOrderForm(String(item.id))}>
                  <Text style={styles.addOrderText}>{t('peptidesPatient.addOrder')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.medActions}>
              <TouchableOpacity onPress={() => handleDownloadPrescription(item)} disabled={downloadingId === String(item.id)}>
                <Text style={styles.actionLink}>{downloadingId === String(item.id) ? t('peptidesPatient.downloading') : t('peptidesPatient.pdfLabel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(item)}>
                <Text style={styles.actionLink}>{t('common.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={[styles.actionLink, { color: colors.danger }]}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
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

  medCard: { gap: spacing.sm, ...shadows.sm },
  medRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  medName: { ...typography.h4, color: colors.text.primary },
  medDosage: { ...typography.body2, color: colors.text.secondary },
  schedule: { ...typography.body2, color: colors.text.muted, marginTop: 2 },

  medActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionLink: { ...typography.label, color: colors.primary, fontWeight: '600' as const },

  ordersBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 4 },
  ordersLabel: { ...typography.label, color: colors.text.muted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 },
  ordersEmpty: { ...typography.caption, color: colors.text.muted },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  orderDate: { ...typography.body2, color: colors.text.primary, flex: 1 },
  orderDose: { ...typography.body2, color: colors.text.secondary, marginRight: spacing.sm },
  orderDeleteText: { ...typography.caption, color: colors.text.muted, paddingHorizontal: 4 },
  orderForm: { gap: spacing.sm, marginTop: spacing.xs },
  addOrderText: { ...typography.label, color: colors.primary, fontWeight: '600' as const, marginTop: 2 },

  formCard: { gap: spacing.md, marginBottom: spacing.md },
  formTitle: { ...typography.h4, color: colors.text.primary },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.text.secondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText: { ...typography.body2, color: colors.text.secondary },
  chipTextSelected: { color: colors.primary, fontWeight: '600' as const },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  removeTimeBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTimeText: { color: colors.text.secondary, fontSize: 16 },
  addTimeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
  },
  addTimeText: { ...typography.body2, color: colors.primary, fontWeight: '600' as const },

  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },

  formActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  cancelBtnText: { ...typography.label, color: colors.text.secondary },
});
