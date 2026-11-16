/**
 * Parañaque CSN Emergency Alert System — Guardian Mobile App (Expo / React Native)
 * Install (inside your Expo project):
 *   npx expo install expo-location @expo/vector-icons
 */
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { firebaseLogout } from './src/firebase';

import { Toast } from './src/components/Toast';
import { API_BASE_URL, DEV_BYPASS_LOGIN, IS_DEV } from './src/config/env';
import { DEFAULT_PARANAQUE_COORDS, POLL_INTERVAL_MS } from './src/constants/app';
import { AlertHistoryScreen } from './src/screens/AlertHistoryScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { EmergencyActiveScreen } from './src/screens/EmergencyActiveScreen';
import { LiveLocationScreen } from './src/screens/LiveLocationScreen';
import { MedicalProfileScreen } from './src/screens/MedicalProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { api } from './src/services/api';
import { devState } from './src/services/devMock';
import { getStoredToken, removeStoredToken, saveStoredToken } from './src/services/tokenStorage';
import { C } from './src/theme/colors';
import { styles } from './src/theme/styles';

import { AppProvider, useApp } from './src/context/AppContext';

/* ============================================================================
 * ROOT APP
 * ========================================================================== */

function MainApp() {
  const { settings, updateSettings, isDark, colors, t, setUserRole } = useApp();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [screen, setScreen]               = useState('welcome');
  const [screenParams, setScreenParams]   = useState({});
  const [token, setToken]                 = useState(null);
  const [guardian, setGuardian]           = useState(null);
  const [child, setChild]                 = useState(null);
  const [childrenList, setChildrenList]   = useState([]);

  const [gps, setGps]               = useState({ state: 'checking' }); // checking | active | denied
  const [coords, setCoords]         = useState(null);
  const [liveSharing, setLiveSharing] = useState(true);

  const [emergency, setEmergency]                 = useState(null);
  const [triggering, setTriggering]               = useState(false);
  const [triggerError, setTriggerError]           = useState('');
  const [cancelling, setCancelling]               = useState(false);
  const [confirmingArrival, setConfirmingArrival] = useState(false);

  const [unread, setUnread]             = useState(0);
  const [seenIds, setSeenIds]           = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, tone = 'success') => setToast({ message, tone, id: Date.now() }), []);

  const go = useCallback((next, params = {}) => {
    setScreenParams(params);
    setScreen(next);
  }, []);

  const applyProfilePayload = useCallback((data) => {
    if (!data) return;
    const profile = data.guardian || data.user || null;
    const role = (profile && profile.role) ? profile.role : 'guardian';
    setGuardian(profile);
    setUserRole(role);

    const list = Array.isArray(data.children)
      ? data.children
      : (data.child ? [data.child] : []);
    setChildrenList(list);
    setChild(data.child || (role !== 'teacher' && list.length > 0 ? list[0] : null));

    if (Object.prototype.hasOwnProperty.call(data, 'active_emergency')) {
      setEmergency((prev) => {
        if (data.active_emergency) {
          if (!prev || prev.id !== data.active_emergency.id) {
            // New active emergency appeared (e.g., teacher alerted parent)
            if (role !== 'teacher' && data.active_emergency.reported_by_role === 'teacher') {
              showToast('🚨 Alert from CSN Center! Tap the emergency banner for details.', 'error');
            }
          }
          return data.active_emergency;
        }
        return null;
      });
    }
  }, [setUserRole, showToast]);

  /* ---- auth ---- */
  const onAuthed = async (data) => {
    setToken(data.token);
    applyProfilePayload(data);
    if (data.token) {
      await saveStoredToken(data.token);
    }
    go('dashboard');
  };

  const logout = async () => {
    try {
      await firebaseLogout();
      if (token) {
        await api('/auth/logout', { method: 'POST', token });
      }
    } catch {}
    await removeStoredToken();
    setToken(null);
    setGuardian(null);
    setUserRole('guardian');
    setChild(null);
    setChildrenList([]);
    setEmergency(null);
    go('welcome');
  };

  // Auto-restore login session on startup (Screen 1 Table 1.0 auto-redirect logic)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (DEV_BYPASS_LOGIN) {
          if (isMounted) {
            setToken('dev-token');
            setGuardian(devState.guardian);
            setUserRole(devState.guardian?.role || 'guardian');
            setChild(devState.child);
            setChildrenList(devState.children || [devState.child]);
            go('dashboard');
          }
          return;
        }

        const savedToken = await getStoredToken();
        if (savedToken && API_BASE_URL) {
          const data = await api('/me', { token: savedToken });
          if (isMounted && data && (data.guardian || data.user)) {
            setToken(savedToken);
            applyProfilePayload(data);
            go('dashboard');
            return;
          }
        }
      } catch {
        await removeStoredToken();
      } finally {
        if (isMounted) setBootstrapping(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [go, applyProfilePayload, setUserRole]);

  /* ---- GPS permission + live position on Dashboard & Location screens ---- */
  const refreshGps = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setGps({ state: 'denied' });
        if (IS_DEV) setCoords((prev) => prev || DEFAULT_PARANAQUE_COORDS);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords(pos.coords);
      setGps({ state: 'active' });
    } catch {
      setGps({ state: 'denied' });
      if (IS_DEV) setCoords((prev) => prev || DEFAULT_PARANAQUE_COORDS);
    }
  }, []);

  useEffect(() => {
    if (screen !== 'dashboard' && screen !== 'location') return undefined;
    let sub;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          setGps({ state: 'denied' });
          if (IS_DEV) setCoords((prev) => prev || DEFAULT_PARANAQUE_COORDS);
          return;
        }
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
          (pos) => {
            setCoords(pos.coords);
            setGps({ state: 'active' });
          }
        );
      } catch {
        if (!cancelled) {
          setGps({ state: 'denied' });
          if (IS_DEV) setCoords((prev) => prev || DEFAULT_PARANAQUE_COORDS);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, [screen]);

  /* ---- unread announcements count & live /me sync (detects teacher-triggered alerts for parents) ---- */
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const syncInboxAndProfile = () => {
      api('/announcements', { token })
        .then((d) => {
          if (!active) return;
          const list = (d && d.announcements) || [];
          const activeList = list.filter((n) => !dismissedIds.includes(n.id));
          setUnread(activeList.filter((n) => !seenIds.includes(n.id)).length);
        })
        .catch(() => {});

      if (screen !== 'active') {
        api('/me', { token })
          .then((d) => {
            if (active && d && (d.guardian || d.user)) {
              applyProfilePayload(d);
            }
          })
          .catch(() => {});
      }
    };

    syncInboxAndProfile();
    const timer = setInterval(syncInboxAndProfile, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [screen, token, seenIds, dismissedIds, applyProfilePayload]);

  const onMarkRead = useCallback((ids) => {
    setSeenIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids]));
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const onDismissAnnouncement = useCallback((id) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  /* ---- trigger emergency (Screen 5 Table 1.5) ---- */
  const triggerEmergency = async (payload) => {
    const isObj = typeof payload === 'object' && payload !== null;
    const type = isObj ? payload.type : payload;
    const urgency = isObj && payload.urgency ? payload.urgency : 'high';
    const message = isObj && payload.message ? payload.message : '';
    const shareLoc = isObj && typeof payload.shareLocation === 'boolean' ? payload.shareLocation : true;
    const childId = isObj && payload.childId ? payload.childId : null;
    const facilityRoom = isObj && payload.facilityRoom ? payload.facilityRoom : null;
    const explicitLocation = isObj && payload.location ? payload.location : null;

    setLiveSharing(shareLoc);
    setTriggerError('');
    setTriggering(true);
    let position = coords;
    if (shareLoc) {
      try {
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        position = fresh.coords;
        setCoords(fresh.coords);
      } catch {
        if (IS_DEV && !position) position = DEFAULT_PARANAQUE_COORDS;
      }
    }
    try {
      const data = await api('/emergencies', {
        method: 'POST',
        token,
        body: {
          child_id: childId,
          facility_room: facilityRoom,
          location: explicitLocation,
          type,
          urgency,
          message,
          guardian_notes: message,
          lat: shareLoc && position ? position.latitude : (facilityRoom ? 14.4997 : null),
          lng: shareLoc && position ? position.longitude : (facilityRoom ? 120.9949 : null),
        },
      });
      setEmergency(data.emergency);
      go('active');
    } catch (err) {
      setTriggerError(err.message);
    } finally {
      setTriggering(false);
    }
  };

  /* ---- while an emergency is active: poll status + stream location ---- */
  const emergencyId     = emergency ? emergency.id : null;
  const emergencyStatus = emergency ? emergency.status : null;
  const isLive =
    screen === 'active' &&
    emergencyId &&
    emergencyStatus !== 'resolved' &&
    emergencyStatus !== 'cancelled';

  useEffect(() => {
    if (!isLive) return undefined;
    const timer = setInterval(async () => {
      try {
        const data = await api(`/emergencies/${emergencyId}`, { token });
        if (data && data.emergency) setEmergency(data.emergency);
      } catch {
        /* keep trying on the next tick */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isLive, emergencyId, token]);

  useEffect(() => {
    if (!isLive || !liveSharing) return undefined;
    let sub;
    let cancelled = false;
    (async () => {
      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
          (pos) => {
            setCoords(pos.coords);
            api(`/emergencies/${emergencyId}/location`, {
              method: 'PATCH',
              token,
              body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            }).catch(() => {});
          }
        );
        if (cancelled && sub) sub.remove();
      } catch {
        /* no GPS; alert is already sent */
      }
    })();
    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, [isLive, liveSharing, emergencyId, token]);

  const confirmResponderArrived = async (targetId = emergencyId) => {
    if (!targetId) return false;
    setConfirmingArrival(true);
    try {
      const data = await api(`/emergencies/${targetId}/arrived`, { method: 'POST', token });
      const updated = (data && data.emergency) || {
        ...emergency,
        status: 'arrived',
        responder_arrived_at: new Date().toISOString(),
      };
      setEmergency(updated);
      showToast('Responder arrival confirmed! CSN Admin & Command Center notified.');
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      setConfirmingArrival(false);
    }
  };

  const cancelEmergency = async () => {
    setCancelling(true);
    try {
      const data = await api(`/emergencies/${emergencyId}/cancel`, { method: 'POST', token });
      setEmergency((data && data.emergency) || { ...emergency, status: 'cancelled' });
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      setCancelling(false);
    }
  };

  /* ---- render ---- */
  let content;
  switch (screen) {
    case 'login':
      content = <AuthScreen mode="login" go={go} onAuthed={onAuthed} showToast={showToast} />;
      break;
    case 'signup':
      content = <AuthScreen mode="signup" go={go} onAuthed={onAuthed} showToast={showToast} />;
      break;
    case 'dashboard':
      content = (
        <DashboardScreen
          guardian={guardian}
          child={child}
          childrenList={childrenList}
          activeEmergency={emergency}
          onOpenActiveEmergency={() => go('active')}
          onConfirmArrived={() => confirmResponderArrived(emergency?.id)}
          confirmingArrival={confirmingArrival}
          initialSelectedChildId={screenParams.selectedChildId || null}
          initialOpenTrigger={Boolean(screenParams.openTriggerModal)}
          gps={gps}
          coords={coords}
          go={go}
          onTrigger={triggerEmergency}
          triggering={triggering}
          triggerError={triggerError}
          clearTriggerError={() => setTriggerError('')}
          unread={unread}
        />
      );
      break;
    case 'location':
      content = (
        <LiveLocationScreen
          child={child}
          gps={gps}
          coords={coords}
          liveSharing={liveSharing}
          onToggleLiveSharing={() => {
            setLiveSharing((v) => {
              const next = !v;
              showToast(next ? 'Live GPS location sharing started.' : 'Live GPS location sharing paused.');
              return next;
            });
          }}
          onRefreshGps={refreshGps}
          go={go}
          unread={unread}
        />
      );
      break;
    case 'active':
      content = (
        <EmergencyActiveScreen
          emergency={emergency}
          coords={coords}
          liveSharing={liveSharing}
          onToggleLiveSharing={() => setLiveSharing((v) => !v)}
          onArrived={() => confirmResponderArrived(emergency?.id)}
          confirmingArrival={confirmingArrival}
          onCancel={cancelEmergency}
          cancelling={cancelling}
          onDone={() => {
            setEmergency(null);
            go('dashboard');
          }}
        />
      );
      break;
    case 'medical':
      content = (
        <MedicalProfileScreen
          guardian={guardian}
          child={child}
          childrenList={childrenList}
          token={token}
          go={go}
          onSaved={setChild}
          onTriggerForChild={(student) => go('dashboard', { selectedChildId: student.id, openTriggerModal: true })}
          showToast={showToast}
          unread={unread}
        />
      );
      break;
    case 'history':
      content = (
        <AlertHistoryScreen
          token={token}
          child={child}
          go={go}
          initialTab={screenParams.tab || 'alerts'}
          showToast={showToast}
          seenIds={seenIds}
          onMarkRead={onMarkRead}
          dismissedIds={dismissedIds}
          onDismissAnnouncement={onDismissAnnouncement}
          unread={unread}
        />
      );
      break;
    case 'inbox':
      content = (
        <AlertHistoryScreen
          token={token}
          child={child}
          go={go}
          initialTab="inbox"
          showToast={showToast}
          seenIds={seenIds}
          onMarkRead={onMarkRead}
          dismissedIds={dismissedIds}
          onDismissAnnouncement={onDismissAnnouncement}
          unread={unread}
        />
      );
      break;
    case 'settings':
      content = (
        <SettingsScreen
          guardian={guardian}
          settings={settings}
          onUpdateSettings={updateSettings}
          go={go}
          onLogout={logout}
          showToast={showToast}
          unread={unread}
        />
      );
      break;
    case 'support':
      content = (
        <SupportScreen
          token={token}
          guardian={guardian}
          child={child}
          go={go}
          onLogout={logout}
          showToast={showToast}
          unread={unread}
        />
      );
      break;
    default:
      content = <WelcomeScreen go={go} />;
  }

  if (bootstrapping) {
    return (
      <View style={[styles.flex, { backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.brand} />
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={40} color={C.brand} />
        </View>
        <ActivityIndicator size="large" color={C.white} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.brand} />
      {content}
      <Toast toast={toast} />
    </View>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
