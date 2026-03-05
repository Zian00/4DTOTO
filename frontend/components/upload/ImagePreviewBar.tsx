import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

type Props = {
  uri: string;
  isUploading: boolean;
  uploadMsg: string;
  onCamera: () => void;
  onGallery: () => void;
  onClear: () => void;
  onUpload: () => void;
};

export function ImagePreviewBar({ uri, isUploading, uploadMsg, onCamera, onGallery, onClear, onUpload }: Props) {
  return (
    <>
      <View style={styles.container}>
        <Image source={{ uri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onCamera}>
            <Text style={styles.actionText}>📷 Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onGallery}>
            <Text style={styles.actionText}>🖼 Change</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.clearBtn]} onPress={onClear}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isUploading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.statusText}>{uploadMsg}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadBtn} onPress={onUpload}>
          <Text style={styles.uploadBtnText}>Read Ticket</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  preview: { width: '100%', height: 260 },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  actionText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.primary },
  clearBtn: { borderRightWidth: 0 },
  clearText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.error },

  statusBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.infoBg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  statusText: { fontSize: Typography.sm, color: Colors.text, textAlign: 'center', lineHeight: 20 },

  uploadBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  uploadBtnText: { color: '#fff', fontWeight: '800', fontSize: Typography.lg },
});
