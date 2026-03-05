import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Slot, usePathname, useRouter } from 'expo-router';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { NotificationBell } from '../NotificationBell';
import { useNotifications } from '../../context/NotificationContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export const NAV_ITEMS: {
  href: '/' | '/history' | '/results' | '/predict';
  label: string;
  tabName: string;
  icon: IoniconsName;
  iconOff: IoniconsName;
}[] = [
  { href: '/',        label: 'Upload',  tabName: 'index',   icon: 'cloud-upload',  iconOff: 'cloud-upload-outline'  },
  { href: '/history', label: 'History', tabName: 'history', icon: 'receipt',       iconOff: 'receipt-outline'        },
  { href: '/results', label: 'Results', tabName: 'results', icon: 'bar-chart',     iconOff: 'bar-chart-outline'      },
  { href: '/predict', label: 'Predict', tabName: 'predict', icon: 'sparkles',      iconOff: 'sparkles-outline'       },
];

export function WebSidebarLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { refresh: refreshNotifications } = useNotifications();
  const activeItem = NAV_ITEMS.find((i) =>
    i.href === '/' ? pathname === '/' : pathname.startsWith(i.href),
  );
  const pageTitle = activeItem?.label ?? '4D / TOTO';

  useEffect(() => {
    void refreshNotifications();
  }, [pathname]);

  return (
    <View style={styles.root}>
      {/* Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>4D</Text>
          </View>
          <View>
            <Text style={styles.brandName}>4D / TOTO</Text>
            <Text style={styles.brandSub}>Ticket Manager</Text>
          </View>
        </View>

        <View style={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <TouchableOpacity
                key={item.href}
                style={[styles.navItem, isActive ? styles.navItemActive : null]}
                activeOpacity={0.75}
                onPress={() => router.push(item.href)}
              >
                <Ionicons
                  name={isActive ? item.icon : item.iconOff}
                  size={20}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.navLabel, isActive ? styles.navLabelActive : null]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sidebarFooter}>
          <Text style={styles.footerText}>Singapore Pools · For personal use only</Text>
        </View>
      </View>

      {/* Main area */}
      <View style={styles.main}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{pageTitle}</Text>
          <NotificationBell tintColor={Colors.text} />
        </View>
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },

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
  brandIconText: { color: '#fff', fontWeight: '900', fontSize: Typography.sm },
  brandName: { fontSize: Typography.base, fontWeight: '800', color: Colors.text },
  brandSub: { fontSize: Typography.xs, color: Colors.textSecondary },

  nav: { flex: 1, padding: Spacing.sm, gap: 2 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  navItemActive: { backgroundColor: Colors.infoBg },
  navLabel: { fontSize: Typography.base, fontWeight: '600', color: Colors.textSecondary },
  navLabelActive: { color: Colors.primary, fontWeight: '700' },

  sidebarFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: { fontSize: Typography.xs, color: Colors.textSecondary, lineHeight: 16 },

  main: { flex: 1, flexDirection: 'column' },
  header: {
    height: 56,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.text },
  content: { flex: 1 },
});
