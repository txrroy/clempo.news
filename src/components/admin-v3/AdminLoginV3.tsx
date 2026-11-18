import { useState } from 'react';
import { View } from 'react-native';
import { V3Button, V3Card, V3Input, V3Rule, V3Text } from './primitives';
import { V3_COLORS, V3_SPACE } from './tokens';

interface AdminLoginV3Props {
  authError: string | null;
  unauthorizedEmail: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AdminLoginV3({
  authError,
  unauthorizedEmail,
  onSignIn,
  onGoogleSignIn,
  onSignOut,
}: AdminLoginV3Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } finally {
      setSubmitting(false);
    }
  };

  if (unauthorizedEmail) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: V3_COLORS.canvas,
          justifyContent: 'center',
          paddingHorizontal: V3_SPACE.xxl,
        }}
      >
        <V3Card
          variant="filled"
          style={{
            maxWidth: 440,
            width: '100%',
            alignSelf: 'center',
            gap: V3_SPACE.lg,
          }}
        >
          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker" tone="danger">
              ACCESS RESTRICTED
            </V3Text>
            <V3Text role="title">Account Not Authorized</V3Text>
            <V3Text role="body" tone="muted">
              Signed in as {unauthorizedEmail}. This account is not on the editor
              allowlist.
            </V3Text>
          </View>
          <V3Button variant="dark" label="Sign out" onPress={onSignOut} />
        </V3Card>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: V3_COLORS.canvas,
        justifyContent: 'center',
        paddingHorizontal: V3_SPACE.xxl,
      }}
    >
      <V3Card
        variant="filled"
        style={{
          maxWidth: 420,
          width: '100%',
          alignSelf: 'center',
          gap: V3_SPACE.lg,
        }}
      >
        <View style={{ gap: V3_SPACE.xs }}>
          <V3Text role="kicker" tone="accent">
            EDITORIAL DESK
          </V3Text>
          <V3Text role="title">SnappyLit Studio</V3Text>
          <V3Text role="body" tone="muted">
            Sign in to collect news, review drafts, and publish editions.
          </V3Text>
        </View>

        <V3Rule />

        {authError ? (
          <V3Text role="body" tone="danger">
            {authError}
          </V3Text>
        ) : null}

        <View style={{ gap: V3_SPACE.md }}>
          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker">EMAIL</V3Text>
            <V3Input
              value={email}
              onChangeText={setEmail}
              placeholder="editor@snappylit.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker">PASSWORD</V3Text>
            <V3Input
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
            />
          </View>
        </View>

        <View style={{ gap: V3_SPACE.sm }}>
          <V3Button
            variant="primary"
            label={submitting ? 'Signing in...' : 'Sign in'}
            disabled={submitting || !email.trim() || !password}
            onPress={() => void handleSignIn()}
          />
          {onGoogleSignIn ? (
            <V3Button
              variant="outline"
              label="Continue with Google"
              disabled={submitting}
              onPress={() => void onGoogleSignIn()}
            />
          ) : null}
        </View>
      </V3Card>
    </View>
  );
}

