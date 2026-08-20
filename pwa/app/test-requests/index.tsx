/**
 * Fleet-wide test/scan requests board — staff/admin only. Mirrors web/src/pages/TestRequestsPage.tsx.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { getAllTestRequests, type TestRequestWithPatient, type TestRequestStatus } from '../../api/testRequests';

const STATUS_LABEL: Record<TestRequestStatus, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  CANCELLED: 'Cancelled',
};

function isOverdue(req: TestRequestWithPatient): boolean {
  return req.status === 'PENDING' && new Date(req.dueDate).getTime() < Date.now();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TestRequestsQueueScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<TestRequestWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');

  const hasLoadedRef = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else if (!hasLoadedRef.current) setLoading(true);
    try {
      setRequests(await getAllTestRequests(filter === 'overdue' ? { overdue: true } : undefined));
    } catch {
      // keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Test/Scan Requests</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'overdue' && styles.filterBtnActive]}
          onPress={() => setFilter('overdue')}
        >
          <Text style={[styles.filterText, filter === 'overdue' && styles.filterTextActive]}>Overdue only</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No test/scan requests yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const overdue = isOverdue(item);
            return (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/patient-dashboard/${item.patientId}`)} activeOpacity={0.8}>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.patient.user.firstName} {item.patient.user.lastName}</Text>
                  <Text style={styles.cardSub}>{item.name} · Due {formatDate(item.dueDate)}</Text>
                </View>
                <View style={[styles.badge, overdue ? styles.badgeOverdue : styles.badgeDefault]}>
                  <Text style={[styles.badgeText, overdue ? styles.badgeTextOverdue : styles.badgeTextDefault]}>
                    {overdue ? 'Overdue' : STATUS_LABEL[item.status]}
                  </Text>
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

  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg.card },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.body2, color: colors.text.secondary },
  filterTextActive: { color: colors.text.inverse, fontWeight: '600' as const },

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
  badgeDefault: { backgroundColor: colors.primaryBg },
  badgeOverdue: { backgroundColor: colors.dangerBg },
  badgeText: { ...typography.caption, fontWeight: '600' as const },
  badgeTextDefault: { color: colors.primary },
  badgeTextOverdue: { color: colors.danger },
});
