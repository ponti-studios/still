import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SFSymbol } from './SFSymbol';
import { radius, spacing, type, useColors } from './theme';

/** A bottom sheet: scrim to dismiss, grip, title, close button. */
export function Sheet({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: spacing.xl + insets.bottom }]}>
            <View style={[styles.grip, { backgroundColor: colors.line }]} />
            <View style={styles.head}>
              <View style={styles.headings}>
                {eyebrow ? <Text style={[styles.eyebrow, { color: colors.faint }]}>{eyebrow}</Text> : null}
                <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
              </View>
              <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
                <SFSymbol name="xmark" size={15} weight="semibold" color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,28,22,0.4)' },
  sheetWrap: { width: '100%', maxHeight: '92%' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    shadowColor: '#18251e',
    shadowOpacity: 0.17,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -10 },
  },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginVertical: spacing.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  headings: { flex: 1, gap: spacing.xs },
  eyebrow: { ...type.micro },
  title: { ...type.title },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
    marginTop: -6,
  },
});
