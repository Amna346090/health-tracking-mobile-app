/**
 * Test/scan requests screen.
 * Patients (viewing their own id) see all requests and can submit PENDING ones by
 * uploading a document (reuses DocumentPicker from the Documents feature — one upload
 * path, not two). Staff/admin (viewing another patient's id) get a read-only list —
 * creating/editing requests happens on the web CRM.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { DocumentPicker } from '../../components/DocumentPicker';
import { useAuth } from '../../context/auth';
import { getTestRequests, submitTestRequest, type TestRequest } from '../../api/testRequests';

const STATUS_LABEL: Record<TestRequest['status'], string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<TestRequest['status'], string> = {
  PENDING: colors.primary,
  SUBMITTED: colors.success,
  CANCELLED: colors.danger,
};

function isOverdue(req: TestRequest): boolean {
  return req.status === 'PENDING' && new Date(req.dueDate).getTime() < Date.now();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TestRequestsScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;

  const [testRequests, setTestRequests] = useState<TestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTestRequests(pid);
      setTestRequests(data.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
    } catch {
      // keep state
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { load(); }, [load]);

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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Test/Scan Requests</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={testRequests}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="🧪"
            title="No test/scan requests"
            subtitle={isOwnPatient ? "Your care team hasn't requested any tests or scans yet." : 'This patient has no test/scan requests yet.'}
          />
        }
        renderItem={({ item }) => {
          const overdue = isOverdue(item);
          return (
            <Card style={styles.reqCard}>
              <View style={styles.reqRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqName}>{item.name}</Text>
                  <Text style={styles.reqMeta}>
                    Due {formatDate(item.dueDate)}{item.instructions ? ` · ${item.instructions}` : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${overdue ? colors.danger : STATUS_COLOR[item.status]}1a` }]}>
                  <Text style={[styles.badgeText, { color: overdue ? colors.danger : STATUS_COLOR[item.status] }]}>
                    {overdue ? 'Overdue' : STATUS_LABEL[item.status]}
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
                      <Text style={styles.actionLink}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.submitBtn} onPress={() => setSubmittingId(item.id)} activeOpacity={0.8}>
                    <Text style={styles.submitBtnText}>Submit</Text>
                  </TouchableOpacity>
                )
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
});
