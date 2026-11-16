import { useState } from 'react';
import { View } from 'react-native';
import { V2Button, V2Input, V2Text } from './primitives';
import { V2_COLORS, V2_SPACE } from './tokens';

interface AdminLoginV2Props {
  authError: string | null;
  unauthorizedEmail: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AdminLoginV2({
  authError,
  unauthorizedEmail,
  onSignIn,
  onGoogleSignIn,
  onSignOut,
}: AdminLoginV2Props) {
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
          backgroundColor: V2_COLORS.ground,
          justifyContent: 'center',
          paddingHorizontal: V2_SPACE.pageSidePadding,
        }}
      >
        <View
          style={{
            maxWidth: 420,
            width: '100%',
            alignSelf: 'center',
            gap: V2_SPACE.gapLg,
          }}
        >
          <View style={{ gap: 8 }}>
            <V2Text variant="pageTitle">Access restricted</V2Text>
            <V2Text variant="body" tone="muted">
              Signed in as {unauthorizedEmail}. This account is not on the editor allowlist.
            </V2Text>
          </View>
          <V2Button
            variant="primary"
            label="Sign out"
            onPress={onSignOut}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: V2_COLORS.ground,
        justifyContent: 'center',
        paddingHorizontal: V2_SPACE.pageSidePadding,
      }}
    >
      <View
        style={{
          maxWidth: 400,
          width: '100%',
          alignSelf: 'center',
          gap: V2_SPACE.gapLg,
        }}
      >
        <View style={{ gap: 4 }}>
          <V2Text variant="pageTitle">SnappyLit Studio</V2Text>
          <V2Text variant="meta">Sign in to review and publish editions.</V2Text>
        </View>

        {authError ? (
          <V2Text variant="body" tone="unverified">
            {authError}
          </V2Text>
        ) : null}

        <View style={{ gap: V2_SPACE.gapMd }}>
          <View style={{ gap: 8 }}>
            <V2Text variant="meta">Email</V2Text>
            <V2Input
              value={email}
              onChangeText={setEmail}
              placeholder="editor@snappylit.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={{ gap: 8 }}>
            <V2Text variant="meta">Password</V2Text>
            <V2Input
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
            />
          </View>
        </View>

        <View style={{ gap: V2_SPACE.gapSm }}>
          <V2Button
            variant="primary"
            label={submitting ? 'Signing in...' : 'Sign in'}
            disabled={submitting}
            onPress={handleSignIn}
          />
          {onGoogleSignIn ? (
            <V2Button
              variant="secondary"
              label="Continue with Google"
              disabled={submitting}
              onPress={onGoogleSignIn}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
