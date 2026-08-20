import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { DoseStatusBadge } from '../../components/DoseStatusBadge';
import { EmptyState } from '../../components/EmptyState';
import {
  getLogsForAssignment,
  logDose,
  getAssignments,
  prescriptionPdfPath,
  type MedicationAssignment,
  type MedicationLog,
} from '../../api/assignments';
import { downloadFile } from '../../api/client';
import { useAuth } from '../../context/auth';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const assignmentId = Number(id);

  const [assignment, setAssignment] = useState<MedicationAssignment | null>(null);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the assignment from patient assignments list (patient can only see their own)
  const loadAssignment = useCallback(async () => {
    if (!user?.patientProfile?.id) return;
    try {
      const all = await getAssignments(user.patientProfile.id, false);
      const found = all.find((a) => a.id === assignmentId);
      if (!found) { setError('Assignment not found'); return; }
      setAssignment(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assignment');
    }
  }, [assignmentId, user?.patientProfile?.id]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await getLogsForAssignment(assignmentId, 20);
      setLogs(data);
    } catch {
      // Non-fatal — just show empty log list
    } finally {
      setLogsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadAssignment(), loadLogs()]);
      setLoading(false);
    })();
  }, [loadAssignment, loadLogs]);

  const handleMarkTaken = useCallback(async () => {
    setMarking(true);
    try {
      await logDose(assignmentId, { status: 'TAKEN' });
      await loadLogs(); // Refresh dose history
    } catch (e) {
      Alert.alert('Could not log dose', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setMarking(false);
    }
  }, [assignmentId, loadLogs]);

  const handleDownloadPrescription = useCallback(async () => {
    if (!user?.patientProfile?.id) return;
    setDownloading(true);
    try {
      const path = prescriptionPdfPath(user.patientProfile.id, assignmentId);
      const fileUri = await downloadFile(path, `prescription-${assignmentId}.pdf`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
    } catch (e) {
      Alert.alert('Could not download prescription', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [assignmentId, user?.patientProfile?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !assignment) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Assignment not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const todayLogged = logs.some((l) => {
    const d = new Date(l.takenAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Nav bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Medication header */}
        <View style={styles.medHeader}>
          <Text style={styles.medName}>{assignment.medication.name}</Text>
          {assignment.medication.dosage && <Text style={styles.medDosage}>{assignment.medication.dosage}</Text>}
          <Text style={styles.schedule}>
            {assignment.frequency
              ? [assignment.frequency, assignment.timesOfDay.join(', ')].filter(Boolean).join(' · ')
              : 'Schedule not set yet'}
          </Text>
        </View>

        {/* Instructions */}
        {assignment.medication.instructions && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Instructions</Text>
            <Text style={styles.infoText}>{assignment.medication.instructions}</Text>
          </View>
        )}

        {/* Download prescription */}
        <TouchableOpacity
          style={[styles.downloadBtn, downloading && styles.markBtnDisabled]}
          onPress={handleDownloadPrescription}
          disabled={downloading}
          activeOpacity={0.8}
        >
          {downloading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.downloadBtnText}>Download Prescription</Text>
          )}
        </TouchableOpacity>

        {/* Mark as taken button */}
        {!todayLogged && (
          <TouchableOpacity
            style={[styles.markBtn, marking && styles.markBtnDisabled]}
            onPress={handleMarkTaken}
            disabled={marking}
            activeOpacity={0.8}
          >
            {marking ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.markBtnText}>Mark Today's Dose as Taken</Text>
            )}
          </TouchableOpacity>
        )}

        {todayLogged && (
          <View style={styles.todayDoneCard}>
            <Text style={styles.todayDoneText}>Today's dose logged ✓</Text>
          </View>
        )}

        {/* Dose history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dose History</Text>
          {logsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          ) : logs.length === 0 ? (
            <EmptyState icon="📋" title="No doses logged yet" subtitle="" />
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <Text style={styles.logDate}>{formatDateTime(log.takenAt)}</Text>
                  {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
                </View>
                <DoseStatusBadge status={log.status} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.body1, color: colors.primary },

  medHeader: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    gap: spacing.xs,
  },
  medName: { ...typography.h2, color: colors.text.primary },
  medDosage: { ...typography.body1, color: colors.text.secondary },
  schedule: { ...typography.body2, color: colors.text.muted },

  infoCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  infoLabel: { ...typography.label, color: colors.text.muted, marginBottom: spacing.xs },
  infoText: { ...typography.body2, color: colors.text.primary },

  markBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  markBtnDisabled: { opacity: 0.6 },
  markBtnText: { ...typography.body1, fontWeight: '600' as const, color: colors.text.inverse },

  downloadBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  downloadBtnText: { ...typography.body1, fontWeight: '600' as const, color: colors.primary },

  todayDoneCard: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  todayDoneText: { ...typography.body1, fontWeight: '600' as const, color: colors.success },

  section: { marginTop: spacing.sm, gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text.primary },

  logRow: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  logLeft: { flex: 1, gap: 2 },
  logDate: { ...typography.body2, color: colors.text.primary },
  logNotes: { ...typography.caption, color: colors.text.muted },

  errorText: { ...typography.body1, color: colors.danger },
});
