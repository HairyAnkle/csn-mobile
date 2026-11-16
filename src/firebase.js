import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch (_) {}

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "csn-paranaque.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "csn-paranaque",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "csn-paranaque.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "967210951869",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with persistence for native platforms
function createFirebaseAuth() {
  if (Platform.OS !== 'web') {
    try {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      return getAuth(app);
    }
  }
  return getAuth(app);
}

export const auth = createFirebaseAuth();

/**
 * Format Firebase Auth errors into friendly messages.
 */
export function formatFirebaseAuthError(err) {
  if (!err) return 'Authentication failed.';
  const code = err.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the administrator.';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In was cancelled.';
    case 'auth/popup-blocked':
      return 'Google Sign-In popup was blocked by browser. Please allow popups.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to many failed attempts. Try again later.';
    default:
      return err.message || 'An error occurred during authentication.';
  }
}

/**
 * Sign in with Email and Password via Firebase Auth.
 */
export async function firebaseLoginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const idToken = await userCredential.user.getIdToken(true);
  return {
    user: userCredential.user,
    idToken,
  };
}

/**
 * Register a new user with Email and Password via Firebase Auth.
 */
export async function firebaseRegisterWithEmail(name, email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name && name.trim()) {
    try {
      await updateProfile(userCredential.user, { displayName: name.trim() });
    } catch (_) {
      // Non-critical profile update failure
    }
  }
  const idToken = await userCredential.user.getIdToken(true);
  return {
    user: userCredential.user,
    idToken,
  };
}

/**
 * Send password reset email via Firebase Auth.
 */
export async function firebaseSendPasswordReset(email) {
  return await sendPasswordResetEmail(auth, email.trim());
}
export const firebaseResetPassword = firebaseSendPasswordReset;

// Real Google OAuth Client IDs registered in Firebase project 'csn-paranaque'
export const GOOGLE_IOS_CLIENT_ID = '967210951869-bfm5ct9bcc0vj2m2enpq42qmagco97tn.apps.googleusercontent.com';
export const GOOGLE_IOS_REDIRECT_URI = 'com.googleusercontent.apps.967210951869-bfm5ct9bcc0vj2m2enpq42qmagco97tn:/oauthredirect';
export const GOOGLE_WEB_CLIENT_ID = '967210951869-8d5gtflrnb1tqfdho2j2q8l9lk6ejpig.apps.googleusercontent.com';

const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Pure JavaScript SHA-256 implementation (avoids native module dependencies like ExpoCrypto)
function sha256Bytes(ascii) {
  function rightRotate(v, a) { return (v >>> a) | (v << (32 - a)); }
  const mathPow = Math.pow, maxWord = mathPow(2, 32);
  let i, j, words = [], hash = [], k = [], primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8);
  const asciiBitLength = ascii.length * 8;
  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16)), oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] + (w[i] = i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  const bytes = [];
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) bytes.push((hash[i] >> (j * 8)) & 255);
  }
  return bytes;
}

function bytesToBase64Url(bytes) {
  let b64 = '', i = 0, len = bytes.length;
  for (; i + 2 < len; i += 3) {
    b64 += B64_CHARS[bytes[i] >> 2];
    b64 += B64_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    b64 += B64_CHARS[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    b64 += B64_CHARS[bytes[i + 2] & 63];
  }
  if (i < len) {
    b64 += B64_CHARS[bytes[i] >> 2];
    if (i + 1 < len) {
      b64 += B64_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      b64 += B64_CHARS[(bytes[i + 1] & 15) << 2];
    } else {
      b64 += B64_CHARS[(bytes[i] & 3) << 4];
    }
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Generate RFC 7636 compliant PKCE code_verifier and code_challenge.
 */
export async function generatePKCECodes() {
  let codeVerifier = '';
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(64));
    for (let i = 0; i < bytes.length; i++) {
      codeVerifier += PKCE_CHARSET[bytes[i] % PKCE_CHARSET.length];
    }
  } else {
    for (let i = 0; i < 64; i++) {
      codeVerifier += PKCE_CHARSET[Math.floor(Math.random() * PKCE_CHARSET.length)];
    }
  }

  const hashBytes = sha256Bytes(codeVerifier);
  const codeChallenge = bytesToBase64Url(hashBytes);
  return { codeVerifier, codeChallenge };
}

/**
 * Safely parse query string and URL fragment/hash parameters.
 */
export function parseAuthUrlParams(url) {
  const params = {};
  if (!url || typeof url !== 'string') return params;

  const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hashPart = url.includes('#') ? url.split('#')[1] : '';

  [queryPart, hashPart].forEach((part) => {
    if (!part) return;
    const pairs = part.split('&');
    pairs.forEach((pair) => {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        const key = decodeURIComponent(pair.slice(0, idx));
        const val = decodeURIComponent(pair.slice(idx + 1));
        if (key && !params[key]) {
          params[key] = val;
        }
      }
    });
  });

  return params;
}

/**
 * Build a PKCE Google OAuth 2.0 session (authUrl + codeVerifier).
 */
export async function createGoogleOAuthSession() {
  const { codeVerifier, codeChallenge } = await generatePKCECodes();

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(GOOGLE_IOS_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_IOS_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid profile email')}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&prompt=select_account`;

  return {
    authUrl,
    codeVerifier,
    redirectUri: GOOGLE_IOS_REDIRECT_URI,
  };
}

/**
 * Complete Google OAuth 2.0 PKCE flow using the redirected URL containing ?code=...
 */
export async function completeGoogleSignInWithRedirectUrl(redirectedUrl, codeVerifier) {
  const params = parseAuthUrlParams(redirectedUrl);
  const code = params.code;

  if (!code) {
    if (params.error === 'access_denied') {
      const err = new Error('Google Sign-In was cancelled.');
      err.code = 'auth/popup-closed-by-user';
      throw err;
    }
    if (params.error) {
      throw new Error(`Google Sign-In error: ${params.error_description || params.error}`);
    }
    throw new Error('Authorization code was not returned by Google.');
  }

  // Exchange authorization code for Google ID token and access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_IOS_CLIENT_ID,
      redirect_uri: GOOGLE_IOS_REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }).toString(),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.id_token) {
    const msg = tokenData.error_description || tokenData.error || 'Failed to exchange authorization code.';
    throw new Error(`Google Token Exchange: ${msg}`);
  }

  // Sign in natively to Firebase Auth using official GoogleAuthProvider credential
  const credential = GoogleAuthProvider.credential(tokenData.id_token);
  const userCredential = await signInWithCredential(auth, credential);
  const firebaseIdToken = await userCredential.user.getIdToken(true);

  return {
    user: userCredential.user,
    idToken: firebaseIdToken || tokenData.id_token,
  };
}

/**
 * Sign in with Google:
 * 1. Web: native Firebase signInWithPopup.
 * 2. Mobile (iOS / Standalone APK):
 *    Direct RFC 8252 Authorization Code Flow with PKCE using the official native iOS Client ID.
 *    Exchanges code for Google id_token and authenticates natively via signInWithCredential.
 */
export async function firebaseGoogleSignIn() {
  if (Platform.OS === 'web') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const userCredential = await signInWithPopup(auth, provider);
    const idToken = await userCredential.user.getIdToken(true);
    return {
      user: userCredential.user,
      idToken,
    };
  }

  // 1. Build PKCE session
  const { authUrl, codeVerifier, redirectUri } = await createGoogleOAuthSession();

  // 2. Open native authentication session
  const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
    preferEphemeralSession: false,
    showInRecents: true,
  });

  if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
    const err = new Error('Google Sign-In was cancelled.');
    err.code = 'auth/popup-closed-by-user';
    throw err;
  }

  if (authResult.type !== 'success' || !authResult.url) {
    throw new Error('Google sign-in could not be completed.');
  }

  // 3. Exchange code and sign in to Firebase
  return await completeGoogleSignInWithRedirectUrl(authResult.url, codeVerifier);
}

/**
 * Sign out of Firebase Auth.
 */
export async function firebaseLogout() {
  try {
    await signOut(auth);
  } catch (_) {
    // Ignore signout cleanup errors
  }
}

/**
 * Send SMS verification code to a mobile phone number via Firebase Identity Platform REST API.
 * @param {string} phoneNumber - E.164 formatted phone number (e.g. '+639171234567')
 * @returns {Promise<{ sessionInfo: string }>}
 */
export async function firebaseSendPhoneVerificationCode(phoneNumber) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${firebaseConfig.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
  });

  const data = await res.json();

  if (!res.ok || !data.sessionInfo) {
    const errorMsg = data?.error?.message || 'Failed to send SMS verification code.';
    const err = new Error(errorMsg);
    err.code = data?.error?.message;
    throw err;
  }

  return { sessionInfo: data.sessionInfo };
}

/**
 * Verify SMS 6-digit OTP code with Firebase Identity Platform and complete sign-in.
 * @param {string} sessionInfo - sessionInfo returned from sendVerificationCode
 * @param {string} code - 6 digit SMS OTP
 * @returns {Promise<{ idToken: string, phoneNumber: string, isNewUser: boolean, localId: string }>}
 */
export async function firebaseVerifyPhoneCode(sessionInfo, code) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${firebaseConfig.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionInfo, code: code.trim() }),
  });

  const data = await res.json();

  if (!res.ok || !data.idToken) {
    const errorMsg = data?.error?.message || 'Invalid or expired verification code.';
    const err = new Error(errorMsg);
    err.code = data?.error?.message;
    throw err;
  }

  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    phoneNumber: data.phoneNumber,
    localId: data.localId,
    isNewUser: data.isNewUser || false,
  };
}


