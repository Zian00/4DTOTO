import { Platform, useWindowDimensions } from 'react-native';

/** Returns true when running on web with a viewport wider than the breakpoint. */
export function useIsWide(breakpoint = 860): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= breakpoint;
}
