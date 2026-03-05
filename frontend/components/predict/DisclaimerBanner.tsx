import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

type Props = {
  text: string;
};

export function DisclaimerBanner({ text }: Props) {
  return (
    <View style={styles.disclaimer}>
      <Text style={styles.title}>⚠️ Important Disclaimer</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderLeftWidth: 4,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.warning,
    marginBottom: Spacing.sm,
  },
  text: {
    fontSize: Typography.sm,
    color: Colors.text,
    lineHeight: 22,
  },
});
