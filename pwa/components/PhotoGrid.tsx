import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Text,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, typography } from '../theme';
import type { Photo } from '../api/photos';
import { PullToRefreshIndicator } from './PullToRefreshIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

const COLS   = 3;
const GAP    = 2;
const WIDTH  = Dimensions.get('window').width;

/** Compute cell size from container width (defaults to full screen width). */
export function cellSize(containerWidth = WIDTH): number {
  return (containerWidth - GAP * (COLS - 1)) / COLS;
}

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Mini-grid (up to 9 items, used inside ScrollView) ───────────────────────

interface MiniGridProps {
  photos: Photo[];
  containerWidth?: number;
  onPress: (photo: Photo) => void;
}

export function MiniPhotoGrid({ photos, containerWidth, onPress }: MiniGridProps) {
  const size = cellSize(containerWidth);
  const shown = photos.slice(0, 9);

  return (
    <View style={styles.miniGrid}>
      {shown.map((photo) => (
        <TouchableOpacity key={photo.id} onPress={() => onPress(photo)} activeOpacity={0.85}>
          <Image
            source={{ uri: photo.url }}
            style={{ width: size, height: size, borderRadius: 2 }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Full scrollable grid (FlatList, use outside ScrollView) ─────────────────

interface FullGridProps {
  photos: Photo[];
  onPress: (photo: Photo) => void;
  ListHeaderComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function PhotoGrid({
  photos,
  onPress,
  ListHeaderComponent,
  ListFooterComponent,
  onEndReached,
  refreshing = false,
  onRefresh,
}: FullGridProps) {
  const { t } = useTranslation();
  const size = cellSize();
  const { pullProgress, scrollHandlers } = usePullToRefresh(() => onRefresh?.());

  return (
    <View style={styles.relative}>
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={refreshing} />
      <FlatList
        data={photos}
        numColumns={COLS}
        keyExtractor={(item) => String(item.id)}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        {...scrollHandlers}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.85}>
            <Image
              source={{ uri: item.url }}
              style={{ width: size, height: size }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('photoGallery.noPhotosYet')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  row:  { gap: GAP },
  grid: { gap: GAP },
  relative: { flex: 1, position: 'relative' },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...(typography.body2 as object),
    color: colors.text.muted,
  },
});
