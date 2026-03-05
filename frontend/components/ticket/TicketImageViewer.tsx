import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

type Props = {
  imageUri: string;
};

export function TicketImageViewer({ imageUri }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  function open() {
    setZoom(1);
    setIsOpen(true);
  }

  function zoomIn() { setZoom((z) => Math.min(z + 0.5, 3)); }
  function zoomOut() { setZoom((z) => Math.max(z - 0.5, 1)); }

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={open}>
        <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="contain" />
        <Text style={styles.hint}>Tap image to zoom</Text>
      </TouchableOpacity>

      <Modal animationType="fade" visible={isOpen} transparent onRequestClose={() => setIsOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <Pressable style={styles.imageWrap} onPress={() => setIsOpen(false)}>
            <Image
              source={{ uri: imageUri }}
              style={[styles.image, { transform: [{ scale: zoom }] }]}
              resizeMode="contain"
            />
          </Pressable>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlBtn} onPress={zoomOut}>
              <Text style={styles.controlText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.zoomLabel}>{`${zoom.toFixed(1)}x`}</Text>
            <TouchableOpacity style={styles.controlBtn} onPress={zoomIn}>
              <Text style={styles.controlText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={() => setZoom(1)}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    marginBottom: Spacing.md,
  },
  hint: {
    marginTop: -8,
    marginBottom: Spacing.md,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.95)',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  closeText: { color: '#fff', fontSize: Typography.sm, fontWeight: '700' },

  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '85%' },

  controls: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: { color: '#fff', fontSize: Typography.lg, fontWeight: '700' },
  zoomLabel: {
    color: '#fff',
    fontSize: Typography.sm,
    fontWeight: '700',
    minWidth: 46,
    textAlign: 'center',
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetText: { color: '#fff', fontSize: Typography.sm, fontWeight: '700' },
});
