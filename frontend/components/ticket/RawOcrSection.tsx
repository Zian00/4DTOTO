import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing, Typography } from '../../constants/theme';
import { Section } from './Section';

const COLLAPSED_LINES = 8;

type Props = {
  rawText: string | null | undefined;
};

export function RawOcrSection({ rawText }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!rawText) return null;

  const lineCount = rawText.split(/\r?\n/).length;
  const wrappedLines = Math.ceil(rawText.length / 72);
  const canToggle = Math.max(lineCount, wrappedLines) > COLLAPSED_LINES;

  return (
    <Section title="Raw OCR Text">
      <Text
        style={styles.text}
        numberOfLines={expanded ? undefined : COLLAPSED_LINES}
      >
        {rawText}
      </Text>
      {canToggle && (
        <TouchableOpacity style={styles.action} onPress={() => setExpanded((prev) => !prev)}>
          <Text style={styles.actionText}>
            {expanded ? 'Show less OCR text' : 'Show full OCR text'}
          </Text>
        </TouchableOpacity>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '700' },
});
