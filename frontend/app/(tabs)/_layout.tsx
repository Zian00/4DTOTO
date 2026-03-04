import { Slot, Tabs, usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const NAV_ITEMS: {
  href: '/' | '/history' | '/results' | '/predict';
  label: string;
  tabName: string;
  icon: IoniconsName;
  iconOff: IoniconsName;
}[] = [
  { href: '/',        label: 'Upload',  tabName: 'index',   icon: 'cloud-upload', iconOff: 'cloud-upload-outline'  },
  { href: '/history', label: 'History', tabName: 'history', icon: 'receipt',      iconOff: 'receipt-outline'        },
  { href: '/results', label: 'Results', tabName: 'results', icon: 'bar-chart',    iconOff: 'bar-chart-outline'      },
  { href: '/predict', label: 'Predict', tabName: 'predict', icon: 'sparkles',     iconOff: 'sparkles-outline'       },
];

const WIDE_BREAKPOINT = 860;

/* ─── Shared tab icon (mobile bottom bar) ─── */
function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const item = NAV_ITEMS.find((i) => i.tabName === name);
  const iconName = item ? (focused ? item.icon : item.iconOff) : 'ellipse-outline';
  return (
    <View style={[mobileStyles.iconWrap, focused && mobileStyles.iconWrapActive]}>
      <Ionicons name={iconName} size={22} color={color} />
    </View>
  );
}

/* ─── Web sidebar layout ─── */
function WebSidebarLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = NAV_ITEMS.find((i) =>
    i.href === '/' ? pathname === '/' : pathname.startsWith(i.href),
  );
  const pageTitle = activeItem?.label ?? '4D / TOTO';

  return (
    <View style={webStyles.root}>
      {/* Sidebar */}
      <View style={webStyles.sidebar}>
        <View style={webStyles.brand}>
          <View style={webStyles.brandIcon}>
            <Text style={webStyles.brandIconText}>4D</Text>
          </View>
          <View>
            <Text style={webStyles.brandName}>4D / TOTO</Text>
            <Text style={webStyles.brandSub}>Ticket Manager</Text>
          </View>
        </View>

        <View style={webStyles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <TouchableOpacity
                key={item.href}
                style={[webStyles.navItem, isActive ? webStyles.navItemActive : null]}
                activeOpacity={0.75}
                onPress={() => router.push(item.href)}
              >
                <Ionicons
                  name={isActive ? item.icon : item.iconOff}
                  size={20}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[webStyles.navLabel, isActive ? webStyles.navLabelActive : null]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={webStyles.sidebarFooter}>
          <Text style={webStyles.footerText}>Singapore Pools · For personal use only</Text>
        </View>
      </View>

      {/* Main area */}
      <View style={webStyles.main}>
        {/* Top header */}
        <View style={webStyles.header}>
          <Text style={webStyles.headerTitle}>{pageTitle}</Text>
        </View>

        {/* Page content */}
        <View style={webStyles.content}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

/* ─── Root export ─── */
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

/* ─── Mobile tab bar styles ─── */
const mobileStyles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Colors.infoBg,
  },
});

/* ─── Web sidebar styles ─── */
const webStyles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },

  /* Sidebar */
  sidebar: {
    width: 230,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    flexDirection: 'column',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: Typography.sm,
  },
  brandName: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.text,
  },
  brandSub: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },

  nav: {
    flex: 1,
    padding: Spacing.sm,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  navItemActive: {
    backgroundColor: Colors.infoBg,
  },
  navLabel: {
    fontSize: Typography.base,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  sidebarFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  /* Main area */
  main: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    height: 56,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
});
