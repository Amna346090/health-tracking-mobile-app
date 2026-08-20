/**
 * Full-screen photo viewer.
 * Navigation params: id (photo ID), patientId (for delete auth check)
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/auth';
import { colors, radius, spacing, typography } from '../../theme';
import { getPhotoById, updatePhoto, deletePhoto, type Photo } from '../../api/photos';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const photoId = Number(id);

  const [photo,   setPhoto]   = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [newAsset, setNewAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPhotoById(photoId)
      .then(setPhoto)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [photoId]);

  const canManage =
    user?.role === 'ADMIN' ||
    user?.role === 'STAFF' ||
    (user?.role === 'PATIENT' && photo?.uploadedBy.id === user.id);

  function confirmDelete() {
    Alert.alert('Delete photo', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deletePhoto(photoId);
            router.back();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  function startEditing() {
    if (!photo) return;
    setEditCaption(photo.caption ?? '');
    setNewAsset(null);
    setEditing(true);
  }

  async function pickReplacement() {
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
    if (!result.canceled) setNewAsset(result.assets[0]);
  }

  async function handleSaveEdit() {
    if (!photo) return;
    setSaving(true);
    try {
      const updated = await updatePhoto(photo.id, {
        patientId: photo.patientId,
        uri: newAsset?.uri,
        mimeType: newAsset?.mimeType ?? 'image/jpeg',
        filename: newAsset?.fileName ?? 'photo.jpg',
        caption: editCaption.trim() || null,
      });
      setPhoto(updated);
      setEditing(false);
      setNewAsset(null);
    } catch (e) {
      Alert.alert('Could not save changes', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !photo) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Photo not found'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.errorText, { color: colors.primary, marginTop: spacing.md }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      {/* Top controls */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <TouchableOpacity onPress={() => (editing ? setEditing(false) : router.back())} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        {canManage && !editing && (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity onPress={startEditing} style={styles.actionBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={styles.actionBtn}>
              {deleting
                ? <ActivityIndicator color={colors.danger} size="small" />
                : <Text style={styles.deleteBtnText}>Delete</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Full-screen image */}
      <Image
        source={{ uri: newAsset?.uri ?? photo.url }}
        style={styles.image}
        resizeMode="contain"
      />

      {editing ? (
        <SafeAreaView edges={['bottom']} style={styles.editPanel}>
          <TouchableOpacity style={styles.replaceBtn} onPress={pickReplacement} disabled={saving}>
            <Text style={styles.replaceBtnText}>{newAsset ? 'Choose a different photo' : 'Replace photo'}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.captionInput}
            value={editCaption}
            onChangeText={setEditCaption}
            placeholder="Add a caption (optional)"
            placeholderTextColor="rgba(255,255,255,0.5)"
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSaveEdit} disabled={saving}>
              {saving
                ? <ActivityIndicator color={colors.text.inverse} size="small" />
                : <Text style={styles.saveBtnText}>Save changes</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      ) : (
        /* Bottom info overlay */
        <SafeAreaView edges={['bottom']} style={styles.overlay}>
          <Text style={styles.date}>{formatDate(photo.uploadedAt)}</Text>
          {photo.caption && (
            <Text style={styles.caption}>{photo.caption}</Text>
          )}
          {photo.uploadedBy.role !== 'PATIENT' && (
            <Text style={styles.staffTag}>
              Added by {photo.uploadedBy.firstName} {photo.uploadedBy.lastName} (staff)
            </Text>
          )}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeBtn:     { padding: spacing.sm },
  closeBtnText: { ...(typography.h3 as object), color: '#fff' },
  actionBtn:     { padding: spacing.sm },
  editBtnText:   { ...(typography.body1 as object), color: '#fff', fontWeight: '600' as const },
  deleteBtnText: { ...(typography.body1 as object), color: colors.danger, fontWeight: '600' as const },

  image: { width: SCREEN_W, height: SCREEN_H },

  overlay: {
    position:  'absolute',
    bottom:    0,
    left:      0,
    right:     0,
    paddingHorizontal: spacing.lg,
    paddingTop:  spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: spacing.xs,
  },
  date:     { ...(typography.body2 as object), color: 'rgba(255,255,255,0.75)' },
  caption:  { ...(typography.body1 as object), color: '#fff', fontWeight: '600' as const },
  staffTag: { ...(typography.caption as object), color: colors.warning },

  errorText: { ...(typography.body1 as object), color: colors.danger },

  editPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.75)',
    gap: spacing.sm,
  },
  replaceBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  replaceBtnText: { ...(typography.body2 as object), color: '#fff', fontWeight: '600' as const },
  captionInput: {
    ...(typography.body1 as object),
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
  },
  cancelBtnText: { ...(typography.label as object), color: '#fff' },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...(typography.label as object), color: colors.text.inverse, fontWeight: '600' as const },
});
