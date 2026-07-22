/**
 * Reusable document picker + upload widget.
 * Shows a filename preview after selection (no image thumbnail — most documents
 * aren't images), a progress bar during upload, and calls onUploaded with the
 * saved Document record when done. Mirrors PhotoPicker.tsx's structure.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ExpoDocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { uploadDocument, type Document } from '../api/documents';

interface Props {
  patientId: number;
  onUploaded: (document: Document) => void;
}

export function DocumentPicker({ patientId, onUploaded }: Props) {
  const [asset, setAsset] = useState<ExpoDocumentPicker.DocumentPickerAsset | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function pickDocument() {
    const result = await ExpoDocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled) setAsset(result.assets[0]);
  }

  async function handleUpload() {
    if (!asset) return;
    setUploading(true);
    setProgress(0);
    try {
      const document = await uploadDocument({
        patientId,
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        filename: asset.name,
        onProgress: setProgress,
      });
      setAsset(null);
      setProgress(0);
      onUploaded(document);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (!asset) {
    return (
      <TouchableOpacity style={styles.pickBtn} onPress={pickDocument} activeOpacity={0.8}>
        <Feather name="upload" size={16} color={colors.text.secondary} />
        <Text style={styles.pickBtnText}>Upload Document</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.previewCard}>
      <View style={styles.previewRow}>
        <Feather name="file" size={22} color={colors.primary} />
        <Text style={styles.previewName} numberOfLines={1}>{asset.name}</Text>
      </View>

      {uploading && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}

      <View style={styles.previewActions}>
        <TouchableOpacity style={styles.removeBtn} onPress={() => setAsset(null)} disabled={uploading}>
          <Text style={styles.removeBtnText}>Remove</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator color={colors.text.inverse} size="small" />
            : <Text style={styles.uploadBtnText}>Upload</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderStyle: 'dashed',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.input,
  },
  pickBtnText: { ...typography.label, color: colors.text.secondary },

  previewCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewName: { ...typography.body2, color: colors.text.primary, flex: 1 },

  progressTrack: {
    height: 4,
    backgroundColor: colors.bg.subtle,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  removeBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  removeBtnText: { ...typography.label, color: colors.text.secondary },
  uploadBtn: {
    flex: 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { ...typography.label, color: colors.text.inverse, fontWeight: '600' as const },
});
