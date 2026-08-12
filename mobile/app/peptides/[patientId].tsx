/**
 * Staff/admin view of a specific patient's active peptide assignments — edit or delete
 * (deactivate) one. Patients manage their own peptides from the Peptides tab instead.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { TimeField } from '../../components/TimeField';
import { Input } from '../../components/Input';
import { downloadFile } from '../../api/client';
import {
  getAssignments, deactivateAssignment, updateAssignment, prescriptionPdfPath,
  getOrders, createOrder, deleteOrder, type MedicationAssignment, type MedicationOrder,
} from '../../api/assignments';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly'];

const FREQUENCY_DEFAULT_COUNT: Record<string, number> = {
  'Once daily': 1,
  'Twice daily': 2,
  'Three times daily': 3,
  'As needed': 0,
  'Weekly': 1,
};

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timesForCount(current: string[], count: number): string[] {
  if (count <= current.length) return current.slice(0, count);
  return [...current, ...Array(count - current.length).fill('08:00')];
}

export default function PatientPeptidesScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const pid = Number(patientId);

  const [assignments, setAssignments] = useState<MedicationAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [editingItem, setEditingItem] = useState<MedicationAssignment | null>(null);
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [times, setTimes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refillsAllowed, setRefillsAllowed] = useState('');
  const [saving, setSaving] = useState(false);

  const [orders, setOrders] = useState<Record<number, MedicationOrder[]>>({});
  const [orderFormFor, setOrderFormFor] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState('');
  const [orderDose, setOrderDose] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAssignments(pid);
      setAssignments(data);
      const entries = await Promise.all(data.map((a) => getOrders(pid, a.id).then((o) => [a.id, o] as const)));
      setOrders(Object.fromEntries(entries));
    } catch {
      // keep state
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { load(); }, [load]);

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
    setSaving(true);
    try {
      const parsedRefills = refillsAllowed.trim() ? parseInt(refillsAllowed.trim(), 10) : null;
      const validTimes = times.filter(Boolean);
      const updated = await updateAssignment(pid, editingItem.id, {
        frequency,
        timesPerDay: validTimes.length || undefined,
        timesOfDay: validTimes,
        startDate,
        endDate: endDate.trim() || null,
        refillsAllowed: parsedRefills !== null && !isNaN(parsedRefills) ? parsedRefills : null,
      });
      setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditingItem(null);
    } catch (e) {
      Alert.alert('Could not save changes', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPrescription(item: MedicationAssignment) {
    setDownloadingId(item.id);
    try {
      const path = prescriptionPdfPath(pid, item.id);
      const fileUri = await downloadFile(path, `prescription-${item.id}.pdf`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
    } catch (e) {
      Alert.alert('Could not download prescription', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  function openOrderForm(assignmentId: number) {
    setOrderFormFor(assignmentId);
    setOrderDate(new Date().toISOString().slice(0, 10));
    setOrderDose('');
  }

  async function handleSaveOrder(assignmentId: number) {
    if (!orderDate || !orderDose.trim()) return;
    setSavingOrder(true);
    try {
      const order = await createOrder(pid, assignmentId, { date: orderDate, dose: orderDose.trim() });
      setOrders((prev) => ({ ...prev, [assignmentId]: [order, ...(prev[assignmentId] ?? [])] }));
      setOrderFormFor(null);
    } catch (e) {
      Alert.alert('Could not save order', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleDeleteOrder(assignmentId: number, order: MedicationOrder) {
    setDeletingOrderId(order.id);
    try {
      await deleteOrder(pid, assignmentId, order.id);
      setOrders((prev) => ({ ...prev, [assignmentId]: (prev[assignmentId] ?? []).filter((o) => o.id !== order.id) }));
    } catch (e) {
      Alert.alert('Could not delete order', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDeletingOrderId(null);
    }
  }

  function handleDelete(item: MedicationAssignment) {
    Alert.alert('Delete peptide?', `Remove ${item.medication.name} from this patient's active peptides? This also stops its dose reminders.`, [
      { text: 'Never mind', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await deactivateAssignment(pid, item.id);
            setAssignments((prev) => prev.filter((a) => a.id !== item.id));
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
    <Card style={styles.formCard}>
      <Text style={styles.formTitle}>Edit {editingItem.medication.name}</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Frequency</Text>
        <View style={styles.chipRow}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, frequency === f && styles.chipSelected]}
              onPress={() => handleFrequencyChange(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          Times per day — {times.length} {times.length === 1 ? 'time' : 'times'}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {times.map((t, i) => (
            <View key={i} style={styles.timeRow}>
              <View style={styles.flex}>
                <TimeField label={`Time ${i + 1}`} value={t} onChange={(v) => updateTime(i, v)} />
              </View>
              <TouchableOpacity onPress={() => removeTime(i)} style={styles.removeTimeBtn} accessibilityLabel="Remove this time">
                <Text style={styles.removeTimeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={addTime} style={styles.addTimeBtn} activeOpacity={0.7}>
            <Text style={styles.addTimeText}>+ Add time</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <DateField label="Start date" value={startDate} onChange={setStartDate} />
        </View>
        <View style={styles.half}>
          <DateField label="End date (optional)" value={endDate} onChange={setEndDate} />
        </View>
      </View>

      <View style={styles.formActions}>
        <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.cancelBtn}>
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
        <Text style={styles.title}>Peptides</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={assignments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={EditForm}
        ListEmptyComponent={
          !editingItem ? (
            <EmptyState icon="💊" title="No peptides assigned" subtitle="Assign one from this patient's dashboard." />
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
                    : 'Schedule not set yet'}
                </Text>
              </View>
            </View>

            <View style={styles.ordersBlock}>
              <Text style={styles.ordersLabel}>Order history</Text>
              {(orders[item.id] ?? []).map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <Text style={styles.orderDate}>{formatOrderDate(order.date)}</Text>
                  <Text style={styles.orderDose}>{order.dose}</Text>
                  <TouchableOpacity onPress={() => handleDeleteOrder(item.id, order)} disabled={deletingOrderId === order.id}>
                    <Text style={styles.orderDeleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {(orders[item.id] ?? []).length === 0 && orderFormFor !== item.id && (
                <Text style={styles.ordersEmpty}>No orders logged yet.</Text>
              )}

              {orderFormFor === item.id ? (
                <View style={styles.orderForm}>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <DateField label="Date" value={orderDate} onChange={setOrderDate} />
                    </View>
                    <View style={styles.half}>
                      <Input label="Dose" value={orderDose} onChangeText={setOrderDose} placeholder="e.g. 5mg" />
                    </View>
                  </View>
                  <View style={styles.formActions}>
                    <TouchableOpacity onPress={() => setOrderFormFor(null)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={savingOrder ? 'Saving…' : 'Save order'}
                        onPress={() => handleSaveOrder(item.id)}
                        loading={savingOrder}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => openOrderForm(item.id)}>
                  <Text style={styles.addOrderText}>+ Add order</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.medActions}>
              <TouchableOpacity onPress={() => handleDownloadPrescription(item)} disabled={downloadingId === item.id}>
                <Text style={styles.actionLink}>{downloadingId === item.id ? 'Downloading…' : 'PDF'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEdit(item)}>
                <Text style={styles.actionLink}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} disabled={deletingId === item.id}>
                <Text style={[styles.actionLink, { color: colors.danger }]}>
                  {deletingId === item.id ? 'Deleting…' : 'Delete'}
                </Text>
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
