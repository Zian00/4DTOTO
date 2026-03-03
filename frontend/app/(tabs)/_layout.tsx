import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';

import { Colors } from '../../constants/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '🎫',
    history: '📋',
    results: '📊',
    predict: '🔮',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {icons[name] ?? '•'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Upload',
          tabBarLabel: 'Upload',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
          headerTitle: '4D / TOTO',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => <TabIcon name="history" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarLabel: 'Results',
          tabBarIcon: ({ focused }) => <TabIcon name="results" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="predict"
        options={{
          title: 'Predict',
          tabBarLabel: 'Predict',
          tabBarIcon: ({ focused }) => <TabIcon name="predict" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
