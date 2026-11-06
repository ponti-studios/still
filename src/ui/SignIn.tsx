import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AccountController } from '../core/useAccount';
import { notify } from '../platform/haptics';
import { PrimaryButton } from './controls';
import { SFSymbol } from './SFSymbol';
import { radius, spacing, type, useColors } from './theme';

/** Sign in with an email code. The native account does the work; this only shows it and passes taps along. */
export function SignIn({ account }: { account: AccountController }) {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (account.step === 'codeSent') {
    return (
      <View style={[styles.page, { backgroundColor: colors.bg }]}>
        <View style={[styles.icon, { backgroundColor: colors.greenTint }]}>
          <SFSymbol name="envelope.open.fill" size={26} color={colors.green} />
        </View>
        <Text style={[styles.title, { color: colors.ink }]}>Check your email</Text>
        <Text style={[styles.subtle, { color: colors.muted }]}>A code is on its way to {account.pendingEmail ?? 'you'}.</Text>
        <TextInput
          style={[styles.field, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
          value={code}
          onChangeText={(text) => {
            setCode(text);
            if (account.problem) void account.clearProblem();
          }}
          placeholder="123456"
          placeholderTextColor={colors.faint}
          accessibilityLabel="Sign-in code"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={6}
          editable={!account.busy}
        />
        {account.problem ? (
          <Text style={[styles.problem, { color: account.problemCalm ? colors.muted : colors.danger }]}>{account.problem}</Text>
        ) : null}
        <PrimaryButton
          label={account.busy ? 'Checking…' : 'Sign in'}
          disabled={account.busy}
          style={styles.button}
          onPress={() => {
            void notify('success');
            void account.verify(code);
          }}
        />
        <Pressable disabled={account.busy} onPress={() => { setCode(''); void account.cancelSignIn(); }}>
          <Text style={[styles.link, { color: colors.link }]}>Use a different email</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.bg }]}>
      <View style={[styles.brand, { backgroundColor: colors.green }]}>
        <Text style={styles.brandLetter}>s</Text>
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>Your things, thoughtfully kept.</Text>
      <Text style={[styles.subtle, { color: colors.muted }]}>Sign in with your email to see your things.</Text>
      <TextInput
        style={[styles.field, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (account.problem) void account.clearProblem();
        }}
        placeholder="you@example.com"
        placeholderTextColor={colors.faint}
        accessibilityLabel="Email address"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!account.busy}
        returnKeyType="send"
        onSubmitEditing={() => void account.requestCode(email)}
      />
      {account.problem ? (
        <Text style={[styles.problem, { color: account.problemCalm ? colors.muted : colors.danger }]}>{account.problem}</Text>
      ) : null}
      <PrimaryButton
        label={account.busy ? 'Sending…' : 'Send a code'}
        disabled={account.busy}
        style={styles.button}
        onPress={() => void account.requestCode(email)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  brand: {
    width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.sm,
  },
  brandLetter: { color: '#fff', fontSize: 30, fontWeight: '600', fontFamily: 'Georgia' },
  icon: {
    width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: spacing.sm,
  },
  title: { ...type.display, textAlign: 'center' },
  subtle: { ...type.body, textAlign: 'center' },
  field: {
    borderWidth: 1, borderRadius: radius.md, minHeight: 52,
    paddingHorizontal: spacing.lg, fontSize: 16, marginTop: spacing.sm,
  },
  problem: { ...type.footnote, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.sm },
  link: { ...type.subhead, textAlign: 'center', padding: spacing.sm },
});
