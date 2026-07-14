import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { colors, spacing, shadows } from '../../theme';
import { useAuth } from '../../context/auth';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const { user } = useAuth();
  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';

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
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
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
          title: 'Medications',
          tabBarIcon: ({ color, size }) => <TabIcon name="medical-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="health-log"
        options={{
          title: 'Health Log',
          tabBarIcon: ({ color, size }) => <TabIcon name="pulse-outline" color={color} size={size} />,
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
