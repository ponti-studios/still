import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { impact } from '../platform/haptics';
import { SFSymbol } from './SFSymbol';
import { radius, spacing, type } from './theme';
import { useColors } from './theme';

/** The one primary button: green pill, white text, quiet haptic on tap. */
export function PrimaryButton({ label, onPress, disabled, style }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        void impact('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.green, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

/** A labeled field with a required marker and a one-line error slot. */
export function Field({ label, required, error, children }: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.ink }]}>
        {label}{required ? <Text style={[styles.required, { color: colors.danger }]}> *</Text> : null}
      </Text>
      {children}
      {error ? <Text style={[styles.fieldError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

/** The one empty state: dashed card, one calm line, optional action. */
export function EmptyState({ body, actionLabel, onAction }: {
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <Text style={[styles.emptyText, { color: colors.muted }]}>{body}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

/** A list head: title plus count, nothing else. */
export function SectionHeader({ title, count }: { title: string; count?: number }) {
  const colors = useColors();
  return (
    <View style={styles.head}>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {count !== undefined ? (
        <Text style={[styles.count, { color: colors.muted }]}>
          {count} {count === 1 ? 'item' : 'items'}
        </Text>
      ) : null}
    </View>
  );
}

/** The chevron: a symbol, never text. */
export function Chevron({ color }: { color?: string }) {
  const colors = useColors();
  return <SFSymbol name="chevron.right" size={14} weight="semibold" color={color ?? colors.faint} />;
}

/** The overflow action: a symbol in a 44px target. */
export function DotsButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        void impact('light');
        onPress();
      }}
      accessibilityLabel={label}
      hitSlop={12}
      style={styles.dots}
    >
      <SFSymbol name="ellipsis" size={17} weight="semibold" color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  field: { gap: spacing.sm },
  label: { ...type.subhead },
  required: {},
  fieldError: { ...type.caption },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xxxl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
  },
  emptyText: { ...type.body, textAlign: 'center' },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  title: { ...type.headline },
  count: { ...type.footnote },
  dots: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
