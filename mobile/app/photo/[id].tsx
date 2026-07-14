/**
 * Full-screen photo viewer.
 * Navigation params: id (photo ID), patientId (for delete auth check)
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import { colors, spacing, typography } from '../../theme';
import { getPhotoById, deletePhoto, type Photo } from '../../api/photos';

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

  useEffect(() => {
    getPhotoById(photoId)
      .then(setPhoto)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [photoId]);

  const canDelete =
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
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        {canDelete && (
          <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={styles.deleteBtn}>
            {deleting
              ? <ActivityIndicator color={colors.danger} size="small" />
              : <Text style={styles.deleteBtnText}>Delete</Text>
            }
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Full-screen image */}
      <Image
        source={{ uri: photo.url }}
        style={styles.image}
        resizeMode="contain"
      />

      {/* Bottom info overlay */}
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
  deleteBtn:     { padding: spacing.sm },
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
});
