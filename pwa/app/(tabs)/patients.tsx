import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { api } from '../../api/client';
import { Avatar } from '../../components/Avatar';

interface PatientRow {
  id: number;
  userId: number;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  user: { firstName: string; lastName: string; email: string | null; username: string | null };
}

function PatientCard({ patient, onPress }: { patient: PatientRow; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const name = `${patient.user.firstName} ${patient.user.lastName}`;
  const initials = (patient.user.firstName[0] + (patient.user.lastName[0] ?? patient.user.firstName[1] ?? '')).toUpperCase();
  const dob = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString(i18n.language === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Avatar uri={patient.avatarUrl} initials={initials} size={44} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{name}</Text>
        <Text style={styles.cardSub}>{patient.user.email ?? patient.user.username}</Text>
        {dob && <Text style={styles.cardDob}>{t('patients.dob', { date: dob })}</Text>}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function PatientsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [patients,  setPatients]  = useState<PatientRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const data = await api.get<PatientRow[]>('/patients');
      setPatients(data);
    } catch {
      // keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!query.trim()) return patients;
    const q = query.toLowerCase();
    return patients.filter((p) =>
      `${p.user.firstName} ${p.user.lastName} ${p.user.email ?? ''} ${p.user.username ?? ''}`.toLowerCase().includes(q),
    );
  }, [patients, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('dashboard.patients')}</Text>
          {!loading && (
            <Text style={styles.headerCount}>{t('patients.total', { count: patients.length })}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-patient')} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>{t('patients.add')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('patients.searchPlaceholder')}
          placeholderTextColor={colors.text.muted}
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {query ? t('patients.noMatchSearch') : t('patients.noPatientsYet')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PatientCard
              patient={item}
              onPress={() => router.push(`/patient-dashboard/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.app },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...(typography.h1 as object), color: colors.text.primary },
  headerCount: { ...(typography.caption as object), color: colors.text.muted },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtnText: { ...(typography.body2 as object), color: colors.text.inverse, fontWeight: '600' as const },

  searchRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.bg.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...(typography.body2 as object),
    color: colors.text.primary,
  },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  cardBody:   { flex: 1, gap: 2 },
  cardName:   { ...(typography.body1 as object), fontWeight: '600' as const, color: colors.text.primary },
  cardSub:    { ...(typography.caption as object), color: colors.text.secondary },
  cardDob:    { ...(typography.caption as object), color: colors.text.muted },
  chevron:    { ...(typography.h3 as object), color: colors.text.muted },
  emptyText:  { ...(typography.body2 as object), color: colors.text.muted },
});
