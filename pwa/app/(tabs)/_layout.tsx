import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, shadows } from '../../theme';
import { useAuth } from '../../context/auth';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const { user } = useAuth();
  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, spacing.sm);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.bg.card,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 50 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: spacing.sm,
          ...shadows.sm,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: 'Peptides',
          tabBarIcon: ({ color, size }) => <TabIcon name="medical-outline" color={color} size={size} />,
        }}
      />
      {/* Health Log tab — patients self-log here; staff/admin reach a patient's
          log via Patients tab → patient profile → Health logs instead. */}
      <Tabs.Screen
        name="health-log"
        options={{
          title: 'Health Log',
          href: isStaffOrAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => <TabIcon name="pulse-outline" color={color} size={size} />,
        }}
      />
      {/* Touch-Base Queue — staff/admin only, replaces Health Log in their tab bar */}
      <Tabs.Screen
        name="touch-base-queue"
        options={{
          title: 'Touch-Base',
          href: isStaffOrAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabIcon name="heart-outline" color={color} size={size} />,
        }}
      />
      {/* Patients tab — hidden from PATIENT role via href: null */}
      <Tabs.Screen
        name="patients"
        options={{
          title: 'Patients',
          href: isStaffOrAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabIcon name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <TabIcon name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
