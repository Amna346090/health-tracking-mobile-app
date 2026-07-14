/**
 * Full photo gallery for a patient.
 * Used by both patients (own photos) and staff (any patient).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../theme';
import { PhotoGrid } from '../../components/PhotoGrid';
import { getPhotos, type Photo } from '../../api/photos';

const PAGE = 30;

export default function PhotoGalleryScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const pid = Number(patientId);

  const [photos,     setPhotos]     = useState<Photo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,    setHasMore]    = useState(true);

  const load = useCallback(async (reset = false) => {
    const offset = reset ? 0 : photos.length;
    if (reset) setRefreshing(true); else if (offset === 0) setLoading(true); else setLoadingMore(true);
    try {
      const data = await getPhotos(pid, { limit: PAGE, offset });
      setPhotos(reset ? data : (prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE);
    } catch {
      // keep state
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [pid, photos.length]);

  useEffect(() => { load(true); }, [pid]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Progress Photos</Text>
        <View style={{ width: 60 }} />
      </View>

      <PhotoGrid
        photos={photos}
        onPress={(photo) => router.push(`/photo/${photo.id}`)}
        onEndReached={handleLoadMore}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        ListFooterComponent={
          loadingMore
            ? <View style={styles.footerLoader}><ActivityIndicator color={colors.primary} /></View>
            : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#000',
  },
  backText: { ...(typography.body1 as object), color: '#fff' },
  title:    { ...(typography.h4 as object), color: '#fff' },
  footerLoader: { paddingVertical: spacing.lg, alignItems: 'center' },
});
