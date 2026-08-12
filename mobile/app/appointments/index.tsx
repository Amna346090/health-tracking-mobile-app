/**
 * Fleet-wide appointments board — staff/admin only. Mirrors web/src/pages/AppointmentsPage.tsx.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { getAllAppointments, type AppointmentWithPatient, type AppointmentStatus } from '../../api/appointments';

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<AppointmentStatus, { bg: string; text: string }> = {
  SCHEDULED: { bg: colors.primaryBg, text: colors.primary },
  RESCHEDULED: { bg: colors.warningBg, text: colors.warning },
  COMPLETED: { bg: colors.successBg, text: colors.success },
  CANCELLED: { bg: colors.dangerBg, text: colors.danger },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function AppointmentsQueueScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      setAppointments(await getAllAppointments());
    } catch {
      // keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Appointments</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No appointments scheduled yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const colorSet = STATUS_COLORS[item.status];
            return (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/patient-dashboard/${item.patientId}`)} activeOpacity={0.8}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.patient.user.firstName} {item.patient.user.lastName}</Text>
                  <Text style={styles.cardSub}>{formatWhen(item.scheduledFor)} · {item.reason || 'No reason given'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colorSet.bg }]}>
                  <Text style={[styles.badgeText, { color: colorSet.text }]}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
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
  emptyText: { ...typography.body2, color: colors.text.muted, textAlign: 'center', paddingHorizontal: spacing.lg },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardBody: { flex: 1, gap: 2 },
  cardName: { ...typography.body1, fontWeight: '600' as const, color: colors.text.primary },
  cardSub: { ...typography.caption, color: colors.text.secondary },

  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { ...typography.caption, fontWeight: '600' as const },
});
