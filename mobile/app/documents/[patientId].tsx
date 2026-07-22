/**
 * Documents screen.
 * Patients (viewing their own id) can upload scans/reports/documents.
 * Staff/admin (viewing another patient's id) get a read-only list — tagging/attaching
 * to a visit happens on the web CRM.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { DocumentPicker } from '../../components/DocumentPicker';
import { useAuth } from '../../context/auth';
import { getDocuments, type Document } from '../../api/documents';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileTypeLabel(fileType: string): string {
  if (fileType === 'application/pdf') return 'PDF';
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType === 'application/dicom') return 'DICOM';
  return fileType;
}

export default function DocumentsScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await getDocuments(pid));
    } catch {
      // keep state
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { load(); }, [load]);

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
        <Text style={styles.title}>Documents</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          isOwnPatient ? (
            <View style={{ marginBottom: spacing.md }}>
              <DocumentPicker
                patientId={pid}
                onUploaded={(doc) => setDocuments((prev) => [doc, ...prev])}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="📄"
            title="No documents yet"
            subtitle={isOwnPatient ? 'Tap "Upload Document" to add a scan or report.' : 'This patient has no documents yet.'}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
            <Card style={styles.docCard}>
              <View style={styles.docRow}>
                <Feather name="file-text" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTag}>{item.tag ?? 'Untagged document'}</Text>
                  <Text style={styles.docMeta}>{fileTypeLabel(item.fileType)} · {formatWhen(item.uploadedAt)}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
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
  docCard: { gap: 4 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  docTag: { ...typography.h4, color: colors.text.primary },
  docMeta: { ...typography.caption, color: colors.text.muted, marginTop: 2 },
});
