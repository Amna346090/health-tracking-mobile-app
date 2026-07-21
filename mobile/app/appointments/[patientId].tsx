/**
 * Appointments screen.
 * Patients (viewing their own id) can request, reschedule, and cancel appointments.
 * Staff/admin (viewing another patient's id) get a read-only list — booking happens on the web CRM.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppointments(pid);
      setAppointments(data.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()));
    } catch {
      // keep state
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { load(); }, [load]);

  function openRequestForm() {
    setEditingId(null);
    setDate(todayISO());
    setTime('09:00');
    setReason('');
    setShowForm(true);
  }

  function openRescheduleForm(appointment: Appointment) {
    const d = new Date(appointment.scheduledFor);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditingId(appointment.id);
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setReason(appointment.reason ?? '');
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
      if (editingId !== null) {
        const updated = await updateAppointment(pid, editingId, { scheduledFor, reason: reason.trim() || null });
        setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createAppointment(pid, { scheduledFor, reason: reason.trim() || null });
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
      {isOwnPatient && (
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.addBtn, showForm && styles.addBtnActive]}
            onPress={() => (showForm ? setShowForm(false) : openRequestForm())}
            activeOpacity={0.8}
          >
            <Text style={[styles.addBtnText, showForm && styles.addBtnTextActive]}>
              {showForm ? '✕' : '+ Request Appointment'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showForm && (
        <Card style={styles.formCard}>
          <View style={styles.row}>
            <View style={styles.half}>
              <DateField label="Date" value={date} onChange={setDate} minimumDate={new Date()} />
            </View>
            <View style={styles.half}>
              <TimeField label="Time" value={time} onChange={setTime} />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Follow-up checkup"
              placeholderTextColor={colors.text.muted}
            />
          </View>
          <Button
            label={saving ? 'Saving…' : editingId !== null ? 'Save changes' : 'Request appointment'}
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
              subtitle={isOwnPatient ? "Tap 'Request Appointment' to book one." : 'This patient has no appointments yet.'}
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
            {isOwnPatient && (item.status === 'SCHEDULED' || item.status === 'RESCHEDULED') && (
              <View style={styles.aptActions}>
                <TouchableOpacity onPress={() => openRescheduleForm(item)}>
                  <Text style={styles.actionLink}>Reschedule</Text>
                </TouchableOpacity>
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
