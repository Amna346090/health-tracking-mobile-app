import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/auth';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Avatar } from '../../components/Avatar';
import { MiniPhotoGrid, cellSize } from '../../components/PhotoGrid';
import { colors, radius, shadows, spacing, typography } from '../../theme';
import { getPhotos, type Photo } from '../../api/photos';
import { updateNotificationSettings } from '../../api/notifications';

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
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

function formatGender(gender: string | null): string {
  if (!gender) return '—';
  if (gender === 'PREFER_NOT_TO_SAY') return 'Prefer not to say';
  return gender.charAt(0) + gender.slice(1).toLowerCase();
}

function roleBadgeColor(role: string) {
  if (role === 'ADMIN') return { bg: colors.dangerBg,   text: colors.danger };
  if (role === 'STAFF') return { bg: colors.warningBg,  text: colors.warning };
  return                       { bg: colors.primaryBg,  text: colors.primary };
}

// ─── Progress photo mini-section ──────────────────────────────────────────────

function ProgressPhotosSection({ patientId }: { patientId: number }) {
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
        <Text style={styles.sectionTitle}>PROGRESS PHOTOS</Text>
        {photos.length > 0 && (
          <TouchableOpacity onPress={() => router.push(`/photos/${patientId}`)}>
            <Text style={styles.viewAllText}>View all →</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading…</Text>
      ) : photos.length === 0 ? (
        <Card variant="outlined">
          <Text style={styles.emptyText}>
            No photos yet. Attach a photo when logging a health entry.
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
              <Text style={styles.seeMoreText}>See all photos</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Notification settings ────────────────────────────────────────────────────

function NotificationSettings({ initial, userEmail }: { initial: { push: boolean; email: boolean }; userEmail: string | null }) {
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
      Alert.alert('Error', 'Could not update notification settings.');
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
      <Card variant="outlined" padding={0}>
        <View style={styles.cardInner}>
          <View style={notifStyles.row}>
            <View style={notifStyles.labelCol}>
              <Text style={notifStyles.label}>Push notifications</Text>
              <Text style={notifStyles.sub}>Peptide reminders on this device</Text>
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
              <Text style={notifStyles.label}>Email notifications</Text>
              <Text style={notifStyles.sub}>
                {userEmail ? `Reminders sent to ${userEmail}` : 'Add an email to receive reminders'}
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
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
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
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <Card variant="outlined" padding={0}>
            <View style={styles.cardInner}>
              <ProfileRow label="First name"   value={user.firstName} />
              <ProfileRow label="Last name"    value={user.lastName} />
              <ProfileRow label="Email"        value={user.email ?? '—'} />
              <ProfileRow label="Username"     value={user.username ?? '—'} />
              <ProfileRow label="Member since" value={formatDate(user.createdAt)} />
            </View>
          </Card>
          <Button
            label="Change Password"
            onPress={() => router.push('/change-password')}
            variant="ghost"
          />
        </View>

        {/* Patient profile */}
        {user.patientProfile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PATIENT PROFILE</Text>
            <Card variant="outlined" padding={0}>
              <View style={styles.cardInner}>
                <ProfileRow label="Date of birth" value={user.patientProfile.dateOfBirth ? formatDate(user.patientProfile.dateOfBirth) : '—'} />
                <ProfileRow label="Age"           value={ageFromDob(user.patientProfile.dateOfBirth) !== null ? `${ageFromDob(user.patientProfile.dateOfBirth)}` : '—'} />
                <ProfileRow label="Gender"        value={formatGender(user.patientProfile.gender)} />
                <ProfileRow label="Health issue"  value={user.patientProfile.healthIssue ?? '—'} />
                <ProfileRow label="Phone"          value={user.patientProfile.phone   ?? '—'} />
                <ProfileRow label="Address"        value={user.patientProfile.address ?? '—'} />
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
        {user.role === 'ADMIN' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADMIN</Text>
            <Button
              label="Manage Users"
              onPress={() => router.push('/manage-users')}
              variant="secondary"
            />
          </View>
        )}

        {/* Sign out */}
        <View style={styles.section}>
          <Button
            label="Sign out"
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
