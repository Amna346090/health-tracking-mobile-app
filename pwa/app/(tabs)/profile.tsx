import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/auth';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Avatar } from '../../components/Avatar';
import { MiniPhotoGrid, cellSize } from '../../components/PhotoGrid';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { getPhotos, type Photo } from '../../api/photos';
import { updateNotificationSettings } from '../../api/notifications';
import { STAFF_FEATURES_ENABLED } from '../../config';

const SCREEN_W = Dimensions.get('window').width;
const GRID_W   = SCREEN_W - spacing.lg * 2;

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { ...(typography.label as object), color: colors.text.secondary },
  value: {
    ...(typography.body2 as object),
    color: colors.text.primary,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '60%',
  },
});

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function ageFromDob(iso: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function formatGender(gender: string | null, preferNotToSayLabel: string): string {
  if (!gender) return '—';
  if (gender === 'PREFER_NOT_TO_SAY') return preferNotToSayLabel;
  return gender.charAt(0) + gender.slice(1).toLowerCase();
}

function roleBadgeColor(role: string) {
  if (role === 'ADMIN') return { bg: colors.dangerBg,   text: colors.danger };
  if (role === 'STAFF') return { bg: colors.warningBg,  text: colors.warning };
  return                       { bg: colors.primaryBg,  text: colors.primary };
}

// ─── Progress photo mini-section ──────────────────────────────────────────────

function ProgressPhotosSection({ patientId }: { patientId: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [photos,   setPhotos]  = useState<Photo[]>([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    getPhotos(patientId, { limit: 9 })
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{t('profile.progressPhotos')}</Text>
        {photos.length > 0 && (
          <TouchableOpacity onPress={() => router.push(`/photos/${patientId}`)}>
            <Text style={styles.viewAllText}>{t('profile.viewAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      ) : photos.length === 0 ? (
        <Card variant="outlined">
          <Text style={styles.emptyText}>
            {t('profile.noPhotosYet')}
          </Text>
        </Card>
      ) : (
        <View style={styles.gridWrapper}>
          <MiniPhotoGrid
            photos={photos}
            containerWidth={GRID_W}
            onPress={(photo) => router.push(`/photo/${photo.id}`)}
          />
          {photos.length === 9 && (
            <TouchableOpacity
              style={styles.seeMoreBtn}
              onPress={() => router.push(`/photos/${patientId}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.seeMoreText}>{t('profile.seeAllPhotos')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Notification settings ────────────────────────────────────────────────────

function NotificationSettings({ initial, userEmail }: { initial: { push: boolean; email: boolean }; userEmail: string | null }) {
  const { t } = useTranslation();
  const [push,  setPush]  = useState(initial.push);
  const [email, setEmail] = useState(initial.email);

  async function toggle(field: 'push' | 'email', value: boolean) {
    if (field === 'push')  setPush(value);
    else                   setEmail(value);
    try {
      await updateNotificationSettings(
        field === 'push' ? { notifPush: value } : { notifEmail: value },
      );
    } catch {
      // Revert on error
      if (field === 'push')  setPush(!value);
      else                   setEmail(!value);
      Alert.alert(t('common.error'), t('profile.updateNotifError'));
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>
      <Card variant="outlined" padding={0}>
        <View style={styles.cardInner}>
          <View style={notifStyles.row}>
            <View style={notifStyles.labelCol}>
              <Text style={notifStyles.label}>{t('profile.pushNotifications')}</Text>
              <Text style={notifStyles.sub}>{t('profile.pushNotificationsSub')}</Text>
            </View>
            <Switch
              value={push}
              onValueChange={(v) => toggle('push', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={[notifStyles.row, notifStyles.rowBorder]}>
            <View style={notifStyles.labelCol}>
              <Text style={notifStyles.label}>{t('profile.emailNotifications')}</Text>
              <Text style={notifStyles.sub}>
                {userEmail ? t('profile.emailNotificationsSubWithEmail', { email: userEmail }) : t('profile.emailNotificationsSubNoEmail')}
              </Text>
            </View>
            <Switch
              value={email}
              onValueChange={(v) => toggle('email', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

const notifStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  labelCol: { flex: 1, gap: 2 },
  label: { ...(typography.body2 as object), color: colors.text.primary, fontWeight: '500' as const },
  sub:   { ...(typography.caption as object), color: colors.text.muted },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try { await refreshUser(); } finally { setRefreshing(false); }
  }

  function confirmLogout() {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOutTitle'),
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await logout(); } finally { setLoggingOut(false); }
        },
      },
    ]);
  }

  if (!user) return null;

  const badge = roleBadgeColor(user.role);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <Avatar
            uri={user.patientProfile?.avatarUrl}
            initials={user.firstName[0].toUpperCase()}
            size={80}
            fontSize={28}
          />
          <Text style={styles.fullName}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.email}>{user.email ?? user.username}</Text>
          <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.roleText, { color: badge.text }]}>{user.role}</Text>
          </View>
        </View>

        {/* Account info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.account')}</Text>
          <Card variant="outlined" padding={0}>
            <View style={styles.cardInner}>
              <ProfileRow label={t('profile.firstName')}   value={user.firstName} />
              <ProfileRow label={t('profile.lastName')}    value={user.lastName} />
              <ProfileRow label={t('profile.email')}        value={user.email ?? '—'} />
              <ProfileRow label={t('profile.username')}     value={user.username ?? '—'} />
              <ProfileRow label={t('profile.memberSince')} value={formatDate(user.createdAt, t('language.locale'))} />
            </View>
          </Card>
          <Button
            label={t('profile.changePassword')}
            onPress={() => router.push('/change-password')}
            variant="ghost"
          />
        </View>

        {/* Patient profile */}
        {user.patientProfile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.patientProfile')}</Text>
            <Card variant="outlined" padding={0}>
              <View style={styles.cardInner}>
                <ProfileRow label={t('profile.dateOfBirth')} value={user.patientProfile.dateOfBirth ? formatDate(user.patientProfile.dateOfBirth, t('language.locale')) : '—'} />
                <ProfileRow label={t('profile.age')}           value={ageFromDob(user.patientProfile.dateOfBirth) !== null ? `${ageFromDob(user.patientProfile.dateOfBirth)}` : '—'} />
                <ProfileRow label={t('profile.gender')}        value={formatGender(user.patientProfile.gender, t('profile.preferNotToSay'))} />
                <ProfileRow label={t('profile.healthIssue')}  value={user.patientProfile.healthIssue ?? '—'} />
                <ProfileRow label={t('profile.phone')}          value={user.patientProfile.phone   ?? '—'} />
                <ProfileRow label={t('profile.address')}        value={user.patientProfile.address ?? '—'} />
              </View>
            </Card>
          </View>
        )}

        {/* Progress photos — patients only */}
        {user.role === 'PATIENT' && user.patientProfile && (
          <ProgressPhotosSection patientId={user.patientProfile.id} />
        )}

        {/* Notification preferences */}
        <NotificationSettings
          initial={{ push: user.notifPush, email: user.notifEmail }}
          userEmail={user.email}
        />

        {/* Admin tools */}
        {STAFF_FEATURES_ENABLED && user.role === 'ADMIN' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.admin')}</Text>
            <Button
              label={t('profile.manageUsers')}
              onPress={() => router.push('/manage-users')}
              variant="secondary"
            />
          </View>
        )}

        {/* Sign out */}
        <View style={styles.section}>
          <Button
            label={t('profile.signOutTitle')}
            onPress={confirmLogout}
            variant="danger"
            loading={loggingOut}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.app },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  avatarSection: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  fullName:   { ...(typography.h2 as object), color: colors.text.primary },
  email:      { ...(typography.body2 as object), color: colors.text.secondary },
  roleBadge:  { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 99 },
  roleText:   { ...(typography.caption as object), fontWeight: '600' as const, letterSpacing: 0.5 },

  section: { gap: spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...(typography.h4 as object),
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  viewAllText: { ...(typography.label as object), color: colors.primary },

  cardInner: { paddingHorizontal: spacing.md },

  gridWrapper: { gap: spacing.sm },
  seeMoreBtn: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  seeMoreText: { ...(typography.label as object), color: colors.primary, fontWeight: '600' as const },

  loadingText: { ...(typography.body2 as object), color: colors.text.muted },
  emptyText:   { ...(typography.body2 as object), color: colors.text.muted, padding: spacing.md },
});
