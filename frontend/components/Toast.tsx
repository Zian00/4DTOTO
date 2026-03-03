import React, { useCallback, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { type ToastType } from '../hooks/useToast';

const TYPE_COLORS: Record<ToastType, string> = {
  win: '#15803d',
  loss: '#475569',
  info: '#1d4ed8',
  error: '#b91c1c',
};

export interface ToastState {
  message: string;
  type: ToastType;
}

export function useToastState() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({ message, type });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      timerRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 4000);
    },
    [fadeAnim],
  );

  return { toast, showToast, fadeAnim };
}

export function ToastContainer({
  toast,
  fadeAnim,
}: {
  toast: ToastState | null;
  fadeAnim: Animated.Value;
}) {
  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, backgroundColor: TYPE_COLORS[toast.type] },
      ]}
    >
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 88,
    left: 16,
    right: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
