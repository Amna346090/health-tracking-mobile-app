/**
 * Full photo gallery for a patient.
 * Used by both patients (own photos) and staff (any patient) — both can upload here now,
 * matching the CRM's admin upload tool.
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
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography } from '../../theme';
import { PhotoGrid } from '../../components/PhotoGrid';
import { PhotoPicker } from '../../components/PhotoPicker';
import { useAuth } from '../../context/auth';
import { getPhotos, type Photo } from '../../api/photos';

const PAGE = 30;

export default function PhotoGalleryScreen() {
  const { t } = useTranslation();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const pid = Number(patientId);
  const isOwnPatient = user?.role === 'PATIENT' && user.patientProfile?.id === pid;
  const canUpload = isOwnPatient || user?.role !== 'PATIENT';

  const [photos,     setPhotos]     = useState<Photo[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,    setHasMore]    = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async (reset = false, silent = false) => {
    const offset = reset ? 0 : photos.length;
    if (reset) { if (!silent) setRefreshing(true); } else if (offset === 0) setLoading(true); else setLoadingMore(true);
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

  useFocusEffect(useCallback(() => { load(true, true); }, [pid]));

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
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
        <Text style={styles.title}>{t('photoGallery.title')}</Text>
        {canUpload ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker((v) => !v)}>
            <Feather name={showPicker ? 'x' : 'plus'} size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <PhotoGrid
        photos={photos}
        onPress={(photo) => router.push(`/photo/${photo.id}`)}
        onEndReached={handleLoadMore}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        ListHeaderComponent={
          canUpload && showPicker ? (
            <View style={styles.pickerWrap}>
              <PhotoPicker
                patientId={pid}
                onUploaded={(photo) => {
                  setPhotos((prev) => [photo, ...prev]);
                  setShowPicker(false);
                }}
              />
            </View>
          ) : undefined
        }
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerWrap: { padding: spacing.md },
});
