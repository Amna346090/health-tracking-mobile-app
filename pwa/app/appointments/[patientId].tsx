/**
 * Appointments screen. Patients (viewing their own id) can request, reschedule, and
 * cancel their own appointments. Staff/admin have the same create/reschedule/cancel
 * rights on any patient's appointments, plus "Mark completed" — matching the CRM.
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
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { TimeField } from '../../components/TimeField';
import { useAuth } from '../../context/auth';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  type Appointment,
} from '../../api/appointments';

const STATUS_LABEL: Record<Appointment['status'], string> = {
  SCHEDULED: 'Scheduled',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<Appointment['status'], string> = {
  SCHEDULED: colors.primary,
  RESCHEDULED: colors.warning,
  COMPLETED: colors.success,
  CANCELLED: colors.danger,
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

const TOUCH_BASE_PRESETS: { label: string; weeks?: number; months?: number }[] = [
  { label: '1 week', weeks: 1 },
  { label: '2 weeks', weeks: 2 },
  { label: '1 month', months: 1 },
  { label: '2 months', months: 2 },
];

function addFromNow(preset: { weeks?: number; months?: number }): Date {
  const d = new Date();
  if (preset.weeks) d.setDate(d.getDate() + preset.weeks * 7);
  if (preset.months) d.setMonth(d.getMonth() + preset.months);
  return d;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function AppointmentsScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;
  const canManage = isOwnPatient || user?.role !== 'PATIENT';

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [saving, setSaving] = useState(false);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await getAppointments(pid);
      setAppointments(data.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()));
    } catch {
      // keep state
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [pid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openRequestForm() {
    setEditingId(null);
    setDate(todayISO());
    setTime('09:00');
    setReason('');
    setNotes('');
    setDurationMinutes('30');
    setShowForm(true);
  }

  function applyPreset(preset: { weeks?: number; months?: number }) {
    const d = addFromNow(preset);
    const pad = (n: number) => String(n).padStart(2, '0');
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  function openRescheduleForm(appointment: Appointment) {
    const d = new Date(appointment.scheduledFor);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditingId(appointment.id);
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setReason(appointment.reason ?? '');
    setNotes(appointment.notes ?? '');
    setDurationMinutes(appointment.durationMinutes ? String(appointment.durationMinutes) : '30');
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
      const parsedDuration = durationMinutes.trim() ? Number(durationMinutes) : null;
      if (editingId !== null) {
        const updated = await updateAppointment(pid, editingId, {
          scheduledFor,
          reason: reason.trim() || null,
          ...(!isOwnPatient && { notes: notes.trim() || null }),
          durationMinutes: parsedDuration,
        });
        setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createAppointment(pid, {
          scheduledFor,
          reason: reason.trim() || null,
          ...(!isOwnPatient && { notes: notes.trim() || null }),
          durationMinutes: parsedDuration,
        });
        setAppointments((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      Alert.alert('Could not save appointment', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCompleted(appointment: Appointment) {
    try {
      const updated = await updateAppointment(pid, appointment.id, { status: 'COMPLETED' });
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  function handleCancel(appointment: Appointment) {
    Alert.alert('Cancel appointment?', `${formatWhen(appointment.scheduledFor)}`, [
      { text: 'Never mind', style: 'cancel' },
      {
        text: 'Cancel appointment',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await updateAppointment(pid, appointment.id, { status: 'CANCELLED' });
            setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          } catch (e) {
            Alert.alert('Could not cancel', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  const Header = (
    <View>
      {canManage && (
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.addBtn, showForm && styles.addBtnActive]}
            onPress={() => (showForm ? setShowForm(false) : openRequestForm())}
            activeOpacity={0.8}
          >
            <Text style={[styles.addBtnText, showForm && styles.addBtnTextActive]}>
              {showForm ? '✕' : isOwnPatient ? '+ Request Appointment' : '+ Schedule Appointment'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showForm && (
        <Card style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Touch base in…</Text>
            <View style={styles.presetRow}>
              {TOUCH_BASE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.presetChip}
                  onPress={() => applyPreset(preset)}
                >
                  <Text style={styles.presetChipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <DateField label="Date" value={date} onChange={setDate} minimumDate={new Date()} />
            </View>
            <View style={styles.half}>
              <TimeField label="Time" value={time} onChange={setTime} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Reason (optional)</Text>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Follow-up checkup"
                placeholderTextColor={colors.text.muted}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Duration (min)</Text>
              <TextInput
                style={styles.input}
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          </View>
          {canManage && !isOwnPatient && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Internal notes"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          )}
          <Button
            label={saving ? 'Saving…' : editingId !== null ? 'Save changes' : isOwnPatient ? 'Request appointment' : 'Schedule appointment'}
            onPress={handleSave}
            loading={saving}
          />
        </Card>
      )}
    </View>
  );

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
        <Text style={styles.title}>Appointments</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          !showForm ? (
            <EmptyState
              icon="🗓️"
              title="No appointments yet"
              subtitle={canManage ? 'Tap the button above to book one.' : 'This patient has no appointments yet.'}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.aptCard}>
            <View style={styles.aptRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.aptWhen}>{formatWhen(item.scheduledFor)}</Text>
                <Text style={styles.aptReason}>{item.reason || 'No reason given'}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[item.status]}1a` }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            {canManage && (item.status === 'SCHEDULED' || item.status === 'RESCHEDULED') && (
              <View style={styles.aptActions}>
                <TouchableOpacity onPress={() => openRescheduleForm(item)}>
                  <Text style={styles.actionLink}>Reschedule</Text>
                </TouchableOpacity>
                {!isOwnPatient && (
                  <TouchableOpacity onPress={() => handleMarkCompleted(item)}>
                    <Text style={styles.actionLink}>Mark completed</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleCancel(item)}>
                  <Text style={[styles.actionLink, { color: colors.danger }]}>Cancel</Text>
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
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.text.secondary },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  presetChip: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  presetChipText: { ...typography.label, color: colors.primary, fontWeight: '600' as const },
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
  aptCard: { gap: spacing.sm, ...shadows.sm },
  aptRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  aptWhen: { ...typography.h4, color: colors.text.primary },
  aptReason: { ...typography.body2, color: colors.text.muted, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { ...typography.caption, fontWeight: '700' as const, textTransform: 'uppercase' },
  aptActions: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  actionLink: { ...typography.label, color: colors.primary, fontWeight: '600' as const },
});
