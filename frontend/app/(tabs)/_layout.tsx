import { Platform, useWindowDimensions } from 'react-native';
import { Slot, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/theme';
import { NAV_ITEMS, WebSidebarLayout } from '../../components/navigation/WebSidebarLayout';

const WIDE_BREAKPOINT = 860;

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const item = NAV_ITEMS.find((i) => i.tabName === name);
  const iconName: IoniconsName = item ? (focused ? item.icon : item.iconOff) : 'ellipse-outline';
  return (
    <Ionicons name={iconName} size={22} color={color} />
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;

  if (isWide) {
    return <WebSidebarLayout />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Upload',
          tabBarLabel: 'Upload',
          tabBarIcon: ({ focused, color }) => <TabIcon name="index" focused={focused} color={color} />,
          headerTitle: '4D / TOTO',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ focused, color }) => <TabIcon name="history" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarLabel: 'Results',
          tabBarIcon: ({ focused, color }) => <TabIcon name="results" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="predict"
        options={{
          title: 'Predict',
          tabBarLabel: 'Predict',
          tabBarIcon: ({ focused, color }) => <TabIcon name="predict" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
