import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {
  firebaseLoginWithEmail,
  firebaseRegisterWithEmail,
  firebaseSendPasswordReset as firebaseResetPassword,
  firebaseGoogleSignIn,
  createGoogleOAuthSession,
  completeGoogleSignInWithRedirectUrl,
  formatFirebaseAuthError,
} from '../firebase';

import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCard } from '../components/SectionCard';
import { api } from '../services/api';
import { C, MIN_TOUCH } from '../theme/colors';
import { styles } from '../theme/styles';
import { evaluatePasswordStrength, isValidEmail } from '../utils/validation';

let NativeWebView = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch {
    NativeWebView = null;
  }
}

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

/* ============================================================================
 * SCREEN 2 & SCREEN 3 — LOGIN (Table 1.2) & SIGN-UP (Table 1.3)
 * Redesigned for 0-Cost Operation:
 * - Direct Email & Password authentication with Firebase Auth
 * - Native Google OAuth account selection redirection (prompt: 'select_account')
 * - Full account creation, login, and password reset flows
 * ========================================================================== */

export function AuthScreen({ mode, go, onAuthed, showToast }) {
  const isSignup = mode === 'signup';

  // Common fields
  const [selectedRole, setSelectedRole] = useState('guardian'); // 'guardian' | 'teacher'
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [formError, setFormError] = useState('');

  // Forgot Password Modal (Table 1.2)
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail]               = useState('');
  const [forgotLoading, setForgotLoading]           = useState(false);
  const [forgotError, setForgotError]               = useState('');

  // Android In-App Google OAuth Modal (bypasses Android Expo Go external Custom Tab scheme limitation)
  const [androidOAuthSession, setAndroidOAuthSession] = useState(null);
  const oauthHandledRef = useRef(false);

  // Real-time field handlers
  const onChangeEmail = (val) => {
    setEmail(val);
    if (errors.email) {
      setErrors((prev) => ({
        ...prev,
        email: !val.trim() ? 'Please enter your email.' : !isValidEmail(val) ? 'Enter a valid email address.' : undefined,
      }));
    }
  };

  const onChangePassword = (val) => {
    setPassword(val);
    if (errors.password) {
      setErrors((prev) => ({
        ...prev,
        password: !val ? 'Please enter your password.' : isSignup && val.length < 8 ? 'Use at least 8 characters.' : undefined,
      }));
    }
  };

  const pwdStrength = evaluatePasswordStrength(password);

  /* --------------------------------------------------------------------------
   * 1. EMAIL + PASSWORD SUBMIT
   * ------------------------------------------------------------------------ */
  const validateEmailForm = () => {
    const e = {};
    if (isSignup && !name.trim()) e.name = 'Please enter your full name.';
    if (!email.trim()) e.email = 'Please enter your email address.';
    else if (!isValidEmail(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Please enter your password.';
    else if (isSignup && password.length < 8) e.password = 'Use at least 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitEmailAuth = async () => {
    setFormError('');
    if (!validateEmailForm()) return;
    setLoading(true);

    try {
      let firebaseToken = null;
      let fbAuthError = null;

      // 1. Authenticate with Firebase Auth SDK (with fallback to Laravel Sanctum login for admin-seeded accounts)
      try {
        if (isSignup) {
          const fbRes = await firebaseRegisterWithEmail(name.trim(), email.trim(), password);
          firebaseToken = fbRes.idToken;
        } else {
          const fbRes = await firebaseLoginWithEmail(email.trim(), password);
          firebaseToken = fbRes.idToken;
        }
      } catch (fbErr) {
        console.warn('Firebase Auth notice:', fbErr?.code, fbErr?.message);
        fbAuthError = fbErr;
        if (isSignup) {
          throw new Error(formatFirebaseAuthError(fbErr));
        }
      }

      // 2. Exchange token with Laravel API (or direct /auth/login fallback if account was created via web admin)
      let data;
      if (firebaseToken) {
        data = await api('/auth/firebase', {
          method: 'POST',
          body: {
            id_token: firebaseToken,
            name: isSignup ? name.trim() : undefined,
            role: isSignup ? 'guardian' : selectedRole,
          },
        });
      } else {
        try {
          data = await api(isSignup ? '/auth/register' : '/auth/login', {
            method: 'POST',
            body: isSignup
              ? { name: name.trim(), email: email.trim(), password, role: 'guardian' }
              : { email: email.trim(), password },
          });
        } catch (apiErr) {
          throw fbAuthError ? new Error(apiErr.message || formatFirebaseAuthError(fbAuthError)) : apiErr;
        }
      }

      showToast(isSignup ? 'Account created successfully!' : 'Logged in successfully!');
      onAuthed(data);
    } catch (err) {
      if (err.errors) {
        const mapped = {};
        Object.keys(err.errors).forEach((k) => {
          mapped[k] = Array.isArray(err.errors[k]) ? err.errors[k][0] : String(err.errors[k]);
        });
        setErrors(mapped);
      }
      setFormError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------------------
   * 2. GOOGLE SIGN-IN (Native OAuth with Firebase Authentication)
   * ------------------------------------------------------------------------ */
  const completeGoogleBackendExchange = async (res) => {
    if (!res) return;

    const googleEmail = res.user?.email || '';
    const googleName = res.user?.displayName || googleEmail.split('@')[0] || name.trim() || 'Google Guardian';
    const idToken = res.idToken || null;

    let data;
    const requestedRole = isSignup ? 'guardian' : selectedRole;
    if (idToken) {
      try {
        data = await api('/auth/firebase', {
          method: 'POST',
          body: {
            id_token: idToken,
            name: googleName,
            role: requestedRole,
          },
        });
      } catch (fbApiErr) {
        console.warn('[Auth] /auth/firebase notice, trying /auth/google fallback:', fbApiErr?.message);
        data = await api('/auth/google', {
          method: 'POST',
          body: {
            id_token: idToken,
            email: googleEmail,
            name: googleName,
            role: requestedRole,
          },
        });
      }
    } else {
      data = await api('/auth/google', {
        method: 'POST',
        body: {
          email: googleEmail,
          name: googleName,
          role: requestedRole,
        },
      });
    }

    showToast(googleEmail ? `Signed in as ${googleEmail}!` : 'Signed in successfully with Google!');
    onAuthed(data);
  };

  const isOAuthCallbackUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return (
      url.startsWith('com.googleusercontent.apps.') ||
      url.includes(':/oauthredirect') ||
      url.includes('/oauthredirect?')
    );
  };

  const handleAndroidOAuthRedirect = async (redirectedUrl, codeVerifier) => {
    if (oauthHandledRef.current) return;
    oauthHandledRef.current = true;
    setAndroidOAuthSession(null);
    setLoading(true);
    setFormError('');

    try {
      const res = await completeGoogleSignInWithRedirectUrl(redirectedUrl, codeVerifier);
      await completeGoogleBackendExchange(res);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      setFormError(err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError('');

    // On Android (Expo Go or APK), use the in-app WebView OAuth sheet so the custom
    // Google OAuth redirect is intercepted directly inside the app instead of
    // Chrome on Android treating the custom scheme as a search engine query.
    if (Platform.OS === 'android' && NativeWebView) {
      try {
        setLoading(true);
        oauthHandledRef.current = false;
        const session = await createGoogleOAuthSession();
        setAndroidOAuthSession(session);
      } catch (err) {
        setFormError(err.message || 'Could not initialize Google Sign-In.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await firebaseGoogleSignIn();
      await completeGoogleBackendExchange(res);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        return; // Cleanly ignore user cancel
      }
      setFormError(err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------------------
   * 4. FORGOT PASSWORD
   * ------------------------------------------------------------------------ */
  const openForgotModal = () => {
    setForgotEmail(email.trim());
    setForgotError('');
    setForgotModalVisible(true);
  };

  const submitForgotPassword = async () => {
    const target = forgotEmail.trim();
    if (!target || !isValidEmail(target)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      try {
        await firebaseResetPassword(target);
        setForgotModalVisible(false);
        showToast('Password reset link sent! Check your email.');
        return;
      } catch {
        // Fallback to Laravel reset
      }
      const data = await api('/auth/forgot-password', { method: 'POST', body: { email: target } });
      setForgotModalVisible(false);
      showToast((data && data.message) || 'Password reset link sent. Check your email.');
    } catch (err) {
      setForgotError(err.message || 'Could not send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.authHeader}>
        <Pressable
          onPress={() => go('welcome')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.authHeaderTitle} accessibilityRole="header">
          {isSignup ? 'Sign Up' : 'Login'}
        </Text>
        <View style={{ width: MIN_TOUCH }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.authSubtitle}>
            {isSignup
              ? 'Create your guardian account to enroll your child and access emergency dispatch.'
              : (selectedRole === 'teacher'
                ? 'Sign in with your Superadmin-issued CSN Teacher account.'
                : 'Sign in to your Parañaque CSN guardian account.')}
          </Text>

          {/* Error Banner */}
          {!!formError && (
            <View style={styles.errorBanner} accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle" size={20} color={C.critical} />
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          )}

          {/* Main Auth Card */}
          <SectionCard style={{ marginTop: 8 }}>
            {!isSignup ? (
              <>
                {/* Login Role Indicator: Parent/Guardian vs CSN Teacher */}
                <Text style={[styles.label, { marginBottom: 6 }]}>Account Role</Text>
                <View style={styles.authMethodToggle}>
                  {[
                    { key: 'guardian', label: 'Parent / Guardian', icon: 'people-outline' },
                    { key: 'teacher', label: 'CSN Teacher', icon: 'school-outline' },
                  ].map((r) => {
                    const active = selectedRole === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => setSelectedRole(r.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        style={[styles.authMethodTab, active && styles.authMethodTabActive]}
                      >
                        <Ionicons name={r.icon} size={16} color={active ? C.brand : C.textSec} />
                        <Text style={[styles.authMethodTabText, active && styles.authMethodTabTextActive]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.devAuthNotice}>
                <Ionicons name="information-circle" size={18} color={C.brand} />
                <Text style={styles.devAuthNoticeText}>
                  Parent / Guardian registration only. CSN Teacher accounts are provided by the CSN Superadmin.
                </Text>
              </View>
            )}

            {isSignup && (
              <Field
                label="Guardian Full Name"
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (errors.name && v.trim()) setErrors((p) => ({ ...p, name: undefined }));
                }}
                error={errors.name}
                autoCapitalize="words"
                leftIcon="person-outline"
                placeholder="e.g. Maria Garcia"
              />
            )}

            <Field
              label="Email Address"
              value={email}
              onChangeText={onChangeEmail}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="mail-outline"
              placeholder={!isSignup && selectedRole === 'teacher' ? 'teacher@csn.gov.ph' : 'guardian@email.com'}
            />

            <Field
              label="Password"
              value={password}
              onChangeText={onChangePassword}
              error={errors.password}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
              placeholder="••••••••"
              rightNode={
                <Pressable
                  onPress={() => setShowPass((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
                  style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
                </Pressable>
              }
            />

            {isSignup && password.length > 0 && (
              <View style={{ marginTop: -8, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((lvl) => (
                    <View
                      key={lvl}
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: pwdStrength.score >= lvl ? pwdStrength.color : C.border,
                      }}
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: pwdStrength.color }}>
                  Password Strength: {pwdStrength.label}
                </Text>
              </View>
            )}

            {!isSignup && (
              <Pressable onPress={openForgotModal} accessibilityRole="button" style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            )}

            <PrimaryButton
              title={isSignup ? 'Create Account' : 'Login'}
              onPress={submitEmailAuth}
              loading={loading}
              style={{ marginTop: 4 }}
            />

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In with Account Selection Redirection */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={isSignup ? 'Sign Up with Google' : 'Sign-In with Google'}
              style={({ pressed }) => [
                styles.googleBtn,
                pressed && { opacity: 0.8 },
                loading && { opacity: 0.6 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.brand} style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.googleBtnText}>
                {isSignup ? 'Sign Up with Google' : 'Sign-In with Google'}
              </Text>
            </Pressable>
            <Text style={{ textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 6 }}>
              Choose your Google Account to sign in seamlessly
            </Text>
          </SectionCard>

          {/* Switch between Login and Sign Up */}
          <Pressable
            onPress={() => {
              setErrors({});
              setFormError('');
              go(isSignup ? 'login' : 'signup');
            }}
            accessibilityRole="button"
            style={styles.switchAuthBtn}
          >
            <Text style={styles.switchAuthText}>
              {isSignup ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: C.brand, fontWeight: '800' }}>
                {isSignup ? 'Login' : 'Sign Up'}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Forgot Password Email Modal (Table 1.2) ── */}
      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={[styles.modalIconCircle, { backgroundColor: C.brandLight }]}>
              <Ionicons name="mail-unread-outline" size={30} color={C.brand} />
            </View>
            <Text style={styles.modalTitle}>Reset Your Password</Text>
            <Text style={styles.modalBody}>
              Enter the email address associated with your guardian account and we will send a password reset link.
            </Text>

            {!!forgotError && (
              <View style={[styles.errorBanner, { width: '100%', marginBottom: 12 }]}>
                <Ionicons name="alert-circle" size={18} color={C.critical} />
                <Text style={styles.errorBannerText}>{forgotError}</Text>
              </View>
            )}

            <Field
              label="Registered Email Address"
              value={forgotEmail}
              onChangeText={(t) => { setForgotEmail(t); setForgotError(''); }}
              placeholder="guardian@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
            />

            <PrimaryButton
              title="Send Reset Link"
              icon="send"
              loading={forgotLoading}
              onPress={submitForgotPassword}
            />
            <PrimaryButton
              title="Cancel"
              tone="ghost"
              onPress={() => setForgotModalVisible(false)}
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Android In-App Google Sign-In Modal ── */}
      {!!androidOAuthSession && !!NativeWebView && (
        <Modal
          visible={!!androidOAuthSession}
          animationType="slide"
          onRequestClose={() => setAndroidOAuthSession(null)}
        >
          <SafeAreaView style={[styles.flex, { backgroundColor: '#FFFFFF' }]}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
                backgroundColor: '#FFFFFF',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-google" size={18} color="#EA4335" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                  Sign in with Google
                </Text>
              </View>
              <Pressable
                onPress={() => setAndroidOAuthSession(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close Google Sign-In"
                style={{ paddingHorizontal: 10, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.brand }}>Cancel</Text>
              </Pressable>
            </View>

            <NativeWebView
              source={{ uri: androidOAuthSession.authUrl }}
              userAgent={ANDROID_CHROME_UA}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={[styles.flex, { alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator size="large" color={C.brand} />
                </View>
              )}
              onShouldStartLoadWithRequest={(req) => {
                if (isOAuthCallbackUrl(req?.url)) {
                  handleAndroidOAuthRedirect(req.url, androidOAuthSession.codeVerifier);
                  return false;
                }
                return true;
              }}
              onNavigationStateChange={(navState) => {
                if (isOAuthCallbackUrl(navState?.url)) {
                  handleAndroidOAuthRedirect(navState.url, androidOAuthSession.codeVerifier);
                }
              }}
              onError={(syntheticEvent) => {
                const failingUrl = syntheticEvent?.nativeEvent?.url;
                if (isOAuthCallbackUrl(failingUrl)) {
                  handleAndroidOAuthRedirect(failingUrl, androidOAuthSession.codeVerifier);
                }
              }}
            />
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}
