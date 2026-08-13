import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../theme';
import { getPatientCredentials, type PatientCredentials } from '../../api/patients';
import { ApiError } from '../../api/client';

export default function PatientCredentialsScreen() {
  const router = useRouter();
  const { patientId, userId, name } = useLocalSearchParams<{ patientId: string; userId?: string; name?: string }>();
  const pid = Number(patientId);

  const [credentials, setCredentials] = useState<PatientCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPatientCredentials(pid)
      .then((data) => { if (!cancelled) setCredentials(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load credentials.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pid]);

  function goToResetPassword() {
    if (!userId) return;
    router.push({ pathname: '/reset-password/[userId]', params: { userId, name: name ?? '' } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Login Credentials</Text>
          <View style={{ width: 60 }} />
        </View>

        {name && <Text style={styles.subtitle}>Auto-generated sign-in details for {name}</Text>}

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}

        {error && (
          <View style={styles.formError}>
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && credentials && (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Username / email</Text>
              <Text style={styles.value} selectable>{credentials.identifier ?? '—'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Password</Text>
              {credentials.password ? (
                <Text style={styles.value} selectable>{credentials.password}</Text>
              ) : (
                <Text style={styles.valueMuted}>Not available — reset the password to set one.</Text>
              )}
            </View>
            <Text style={styles.hint}>Long-press a value to copy it.</Text>
          </View>
        )}

        {!loading && userId && (
          <TouchableOpacity style={styles.resetLink} onPress={goToResetPassword}>
            <Text style={styles.resetLinkText}>Reset password</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backText: { ...typography.body1, color: colors.primary },
  navTitle: { ...typography.h4, color: colors.text.primary },
  subtitle: { ...typography.body2, color: colors.text.secondary, marginBottom: spacing.md },

  loading: { marginTop: spacing.xl },

  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { gap: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  label: { ...typography.caption, color: colors.text.muted },
  value: { ...typography.body1, color: colors.text.primary },
  valueMuted: { ...typography.body2, color: colors.text.muted },
  hint: { ...typography.caption, color: colors.text.muted, marginTop: spacing.xs },

  resetLink: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  resetLinkText: { ...typography.body1, color: colors.primary },

  formError: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  formErrorText: { ...typography.body2, color: colors.danger },
});
