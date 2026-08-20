/**
 * Reusable photo picker + upload widget.
 * Shows a thumbnail preview after selection, a progress bar during upload,
 * and calls onUploaded with the saved Photo record when done.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing, typography } from '../theme';
import { uploadPhoto, type Photo } from '../api/photos';

interface Props {
  patientId:    number;
  healthLogId?: number | null;
  onUploaded:   (photo: Photo) => void;
}

export function PhotoPicker({ patientId, healthLogId, onUploaded }: Props) {
  const [asset,    setAsset]    = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption,  setCaption]  = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.82,
    });
    if (!result.canceled) setAsset(result.assets[0]);
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.82,
    });
    if (!result.canceled) setAsset(result.assets[0]);
  }

  function showPicker() {
    Alert.alert('Add Photo', undefined, [
      { text: 'Camera',        onPress: pickFromCamera  },
      { text: 'Photo Library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleUpload() {
    if (!asset) return;
    setUploading(true);
    setProgress(0);
    try {
      const photo = await uploadPhoto({
        patientId,
        uri:         asset.uri,
        mimeType:    asset.mimeType ?? 'image/jpeg',
        filename:    asset.fileName ?? 'photo.jpg',
        caption:     caption.trim() || null,
        healthLogId: healthLogId ?? null,
        onProgress:  setProgress,
      });
      setAsset(null);
      setCaption('');
      setProgress(0);
      onUploaded(photo);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (!asset) {
    return (
      <TouchableOpacity style={styles.pickBtn} onPress={showPicker} activeOpacity={0.8}>
        <Text style={styles.pickBtnIcon}>📷</Text>
        <Text style={styles.pickBtnText}>Attach Photo</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.previewCard}>
      <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />

      {/* Caption input */}
      <TextInput
        style={styles.captionInput}
        value={caption}
        onChangeText={setCaption}
        placeholder="Add a caption (optional)"
        placeholderTextColor={colors.text.muted}
      />

      {/* Progress bar */}
      {uploading && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}

      <View style={styles.previewActions}>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => { setAsset(null); setCaption(''); }}
          disabled={uploading}
        >
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
  pickBtnIcon: { fontSize: 18 },
  pickBtnText: { ...(typography.label as object), color: colors.text.secondary },

  previewCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    backgroundColor: colors.bg.card,
  },
  preview: { width: '100%', height: 180 },

  captionInput: {
    ...(typography.body2 as object),
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginHorizontal: spacing.md,
  },

  progressTrack: {
    height: 4,
    backgroundColor: colors.bg.subtle,
    borderRadius: 2,
    marginHorizontal: spacing.md,
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
  removeBtnText: { ...(typography.label as object), color: colors.text.secondary },
  uploadBtn: {
    flex: 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { ...(typography.label as object), color: colors.text.inverse, fontWeight: '600' as const },
});
