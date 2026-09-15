import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useAuth } from '../context/auth';
import { getAllUsers } from '../api/users';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { listUsersCached, mergeUsersFromServer, deleteUserOffline, type OfflineManagedUser as ManagedUser } from '../offline/entities/users';
import { sameList } from '../offline/util';
import { cache, onCacheChanged } from '../offline/cache';

function roleBadgeColor(role: string) {
  if (role === 'ADMIN') return { bg: colors.dangerBg,   text: colors.danger };
  if (role === 'STAFF') return { bg: colors.warningBg,  text: colors.warning };
  return                       { bg: colors.primaryBg,  text: colors.primary };
}

function UserRow({
  user,
  isSelf,
  onDelete,
  onResetPassword,
  t,
}: {
  user: ManagedUser;
  isSelf: boolean;
  onDelete: (user: ManagedUser) => void;
  onResetPassword: (user: ManagedUser) => void;
  t: TFunction;
}) {
  const badge = roleBadgeColor(user.role);
  const initials = (user.firstName[0] + (user.lastName[0] ?? user.firstName[1] ?? '')).toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowName}>
            {user.firstName} {user.lastName} {isSelf && <Text style={styles.youTag}>{t('manageUsers.you')}</Text>}
          </Text>
          <Text style={styles.rowEmail}>{user.email ?? user.username}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.roleText, { color: badge.text }]}>{user.role}</Text>
        </View>
      </View>
      {!isSelf && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onResetPassword(user)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.resetBtnText}>{t('manageUsers.resetPassword')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onDelete(user)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ManageUsersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [users,     setUsers]     = useState<ManagedUser[]>(() => cache.listSync<ManagedUser>('users'));
  const [loading,   setLoading]   = useState(() => cache.listSync<ManagedUser>('users').length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const byRoleThenCreated = (list: ManagedUser[]) => [...list].sort((a, b) =>
    a.role !== b.role ? a.role.localeCompare(b.role) : b.createdAt.localeCompare(a.createdAt));

  // Local-only refresh — never hits the network. Reacting to a local change (e.g. a delete
  // on this same screen) with a network re-check would race the delete's own request: the
  // re-check can return *before* the delete reaches the server, still see the old row, and
  // put it right back. Only re-reading local storage is safe to run on every local change.
  const refreshFromCache = useCallback(async () => {
    const cached = byRoleThenCreated(await listUsersCached());
    setUsers((prev) => (sameList(prev, cached) ? prev : cached));
    if (cached.length > 0) setLoading(false);
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    await refreshFromCache();
    try {
      const data = await getAllUsers();
      const merged = byRoleThenCreated(await mergeUsersFromServer(data));
      setUsers((prev) => (sameList(prev, merged) ? prev : merged));
    } catch {
      // offline or request failed — keep showing whatever was cached
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshFromCache]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => onCacheChanged('users', () => refreshFromCache()), [refreshFromCache]);

  const { pullProgress, scrollHandlers } = usePullToRefresh(() => load(true));

  function goToResetPassword(target: ManagedUser) {
    router.push({
      pathname: '/reset-password/[userId]',
      params: { userId: String(target.id), name: `${target.firstName} ${target.lastName}` },
    });
  }

  function confirmDelete(target: ManagedUser) {
    Alert.alert(
      t('manageUsers.deleteUserTitle', { name: `${target.firstName} ${target.lastName}` }),
      target.role === 'PATIENT' ? t('manageUsers.deleteUserBodyWithHealth') : t('manageUsers.deleteUserBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteUserOffline(target.id);
            setUsers((prev) => prev.filter((u) => String(u.id) !== String(target.id)));
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={refreshing} />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.backWithArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('manageUsers.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={styles.listContent}
          {...scrollHandlers}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('manageUsers.noUsersFound')}</Text>
          }
          renderItem={({ item }) => (
            <UserRow
              user={item}
              isSelf={String(item.id) === String(currentUser?.id)}
              onDelete={confirmDelete}
              onResetPassword={goToResetPassword}
              t={t}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.app, position: 'relative' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: { ...(typography.body1 as object), color: colors.primary },
  navTitle: { ...(typography.h4 as object), color: colors.text.primary, flex: 1, textAlign: 'center' },

  listContent: { padding: spacing.lg, gap: spacing.sm },

  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  rowDeleting: { opacity: 0.4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...(typography.body2 as object), color: colors.primary, fontWeight: '700' as const },
  rowBody: { flex: 1, gap: 2 },
  rowName: { ...(typography.body2 as object), color: colors.text.primary, fontWeight: '600' as const },
  youTag: { ...(typography.caption as object), color: colors.text.muted, fontWeight: '400' as const },
  rowEmail: { ...(typography.caption as object), color: colors.text.muted },

  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 99 },
  roleText: { ...(typography.caption as object), fontWeight: '600' as const, letterSpacing: 0.5, fontSize: 10 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  resetBtnText: { ...(typography.label as object), color: colors.primary, fontWeight: '600' as const },
  deleteBtnText: { ...(typography.label as object), color: colors.danger, fontWeight: '600' as const },

  emptyText: { ...(typography.body2 as object), color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
