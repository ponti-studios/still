import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AccountController } from '../core/useAccount';
import { colors } from './theme';

/** Sign in with an email code. The native account does the work; this only shows it and passes taps along. */
export function SignIn({ account }: { account: AccountController }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (account.step === 'codeSent') {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtle}>A code is on its way to {account.pendingEmail ?? 'you'}.</Text>
        <TextInput
          style={styles.field}
          value={code}
          onChangeText={(text) => {
            setCode(text);
            if (account.problem) void account.clearProblem();
          }}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          editable={!account.busy}
        />
        {account.problem ? (
          <Text style={account.problemCalm ? styles.calm : styles.alarm}>{account.problem}</Text>
        ) : null}
        <Pressable style={[styles.primary, account.busy && styles.disabled]} disabled={account.busy} onPress={() => void account.verify(code)}>
          <Text style={styles.primaryText}>{account.busy ? 'Checking…' : 'Sign in'}</Text>
        </Pressable>
        <Pressable disabled={account.busy} onPress={() => { setCode(''); void account.cancelSignIn(); }}>
          <Text style={styles.link}>Use a different email</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.brand}>
        <View style={styles.brandMark}><Text style={styles.brandLetter}>s</Text></View>
        <Text style={styles.brandName}>still</Text>
      </View>
      <Text style={styles.title}>Your things, thoughtfully kept.</Text>
      <Text style={styles.subtle}>Sign in with your email to see your things.</Text>
      <TextInput
        style={styles.field}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (account.problem) void account.clearProblem();
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!account.busy}
        returnKeyType="send"
        onSubmitEditing={() => void account.requestCode(email)}
      />
      {account.problem ? (
        <Text style={account.problemCalm ? styles.calm : styles.alarm}>{account.problem}</Text>
      ) : null}
      <Pressable style={[styles.primary, account.busy && styles.disabled]} disabled={account.busy} onPress={() => void account.requestCode(email)}>
        <Text style={styles.primaryText}>{account.busy ? 'Sending…' : 'Send a code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.bg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 8 },
  brandMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#fff', fontSize: 22, fontWeight: '600', fontFamily: 'Georgia' },
  brandName: { fontSize: 22, fontWeight: '700', color: colors.ink },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', color: colors.ink },
  subtle: { textAlign: 'center', color: colors.muted, fontSize: 14 },
  field: {
    borderWidth: 1, borderColor: '#dfe0d9', borderRadius: 10, backgroundColor: '#fff',
    paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: colors.ink,
  },
  primary: {
    minHeight: 48, borderRadius: 10, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  link: { textAlign: 'center', color: colors.link, fontWeight: '600', fontSize: 14, padding: 8 },
  calm: { textAlign: 'center', color: colors.muted, fontSize: 14 },
  alarm: { textAlign: 'center', color: colors.danger, fontSize: 14 },
});
