import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';

/** A bottom sheet: scrim to dismiss, grip, title, close button. */
export function Sheet({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.grip} />
            <View style={styles.head}>
              <View style={styles.headings}>
                {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                <Text style={styles.title}>{title}</Text>
              </View>
              <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close" hitSlop={10}>
                <Text style={styles.closeText}>✕</Text>
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#1c261f55' },
  sheetWrap: { width: '100%', maxHeight: '92%' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    shadowColor: '#18251e',
    shadowOpacity: 0.17,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -10 },
  },
  grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#dcddd6', alignSelf: 'center', marginVertical: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headings: { flex: 1, gap: 4 },
  eyebrow: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4, color: colors.ink },
  close: { padding: 6, marginRight: -6 },
  closeText: { fontSize: 16, color: '#6b6e67' },
});
