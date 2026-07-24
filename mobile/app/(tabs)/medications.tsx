import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import { colors, spacing, typography, radius, shadows } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { AssignmentCard, CatalogMedicationCard } from '../../components/MedicationCard';
import { getAssignments, type MedicationAssignment } from '../../api/assignments';
import { getAllMedications, type Medication } from '../../api/medications';

// ─── Patient view ─────────────────────────────────────────────────────────────

function PatientMedications({ patientId }: { patientId: number }) {
  const router = useRouter();
  const [items, setItems] = useState<MedicationAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await getAssignments(patientId);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load peptides');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
      }
      renderItem={({ item }) => (
        <AssignmentCard
          item={item}
          onPress={(a) => router.push(`/assignment/${a.id}`)}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="💊"
          title="No peptides assigned"
          subtitle="Your prescriptions and dosing schedule will appear here once set up by your care team."
        />
      }
    />
  );
}

// ─── Staff/admin view ──────────────────────────────────────────────────────────

function StaffMedications() {
  const router = useRouter();
  const [items, setItems] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query?: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await getAllMedications(query || undefined);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { load(search); }, 400);
    return () => clearTimeout(timer);
  }, [search, load]);

  return (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search peptides..."
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/medication/add')}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(search)}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(search, true)}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <CatalogMedicationCard
              item={item}
              onPress={(id) => router.push(`/medication/${id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="💊"
              title={search ? 'No results' : 'No peptides'}
              subtitle={
                search
                  ? `No peptides match "${search}"`
                  : 'Add the first peptide to the catalog.'
              }
            />
          }
        />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MedicationsScreen() {
  const { user } = useAuth();
  const isStaff = user?.role === 'STAFF' || user?.role === 'ADMIN';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Peptides</Text>
          <Text style={styles.subtitle}>
            {isStaff ? 'Peptide catalog' : 'Your active prescriptions'}
          </Text>
        </View>

        {isStaff ? (
          <StaffMedications />
        ) : (
          <PatientMedications patientId={user?.patientProfile?.id ?? 0} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  flex: { flex: 1 },
  header: { marginBottom: spacing.md, gap: spacing.xs },
  title: { ...typography.h1, color: colors.text.primary },
  subtitle: { ...typography.body2, color: colors.text.secondary },

  list: { paddingBottom: spacing.xl },

  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body2,
    color: colors.text.primary,
    ...shadows.sm,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  addBtnText: {
    ...typography.label,
    fontWeight: '600' as const,
    color: colors.text.inverse,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { ...typography.body2, color: colors.danger, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: { ...typography.label, color: colors.text.inverse },
});
