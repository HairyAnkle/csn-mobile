import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';

import { useApp } from '../context/AppContext';
import { BottomTabBar } from '../components/BottomTabBar';
import { InteractiveLocationMap } from '../components/InteractiveLocationMap';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCard } from '../components/SectionCard';
import { DEFAULT_PARANAQUE_COORDS } from '../constants/app';
import { NEARBY_EMERGENCY_CENTERS } from '../constants/data';
import { fetchNearbyOsmEmergencyCenters } from '../services/emergencyCenters';
import { C } from '../theme/colors';
import { styles } from '../theme/styles';
import { callEmergencyNumber, openAppSettings } from '../utils/device';
import { calcDistanceKm, useLocationName } from '../utils/geo';

/* ============================================================================
 * SCREEN 6 — LIVE LOCATION SHARING (Table 1.6) & ACTIVE EMERGENCY DISPATCH
 * ========================================================================== */

/** Standalone Screen 6: Live Location Sharing (Table 1.6) */
export function LiveLocationScreen({ child, gps, coords, liveSharing, onToggleLiveSharing, onRefreshGps, go, unread }) {
  const { isDark, colors, t, lang } = useApp();
  const scrollRef = useRef(null);
  const [centers, setCenters]               = useState(NEARBY_EMERGENCY_CENTERS);
  const [selectedCenter, setSelectedCenter] = useState(NEARBY_EMERGENCY_CENTERS[0]);
  const [navTrigger, setNavTrigger]         = useState(null);
  const [loadingOsm, setLoadingOsm]         = useState(false);
  const [osmStatus, setOsmStatus]           = useState('');

  const effectiveCoords = coords || DEFAULT_PARANAQUE_COORDS;
  const hasRealGps = gps.state === 'active' && !!coords;

  const lat = effectiveCoords.latitude;
  const lng = effectiveCoords.longitude;
  const locationName = useLocationName(lat, lng);

  const applyOsmResult = useCallback((list) => {
    if (list) {
      setCenters(list);
      const osmCount = list.filter((c) => c.isOsmLive).length;
      setOsmStatus(
        osmCount > 0
          ? (lang === 'Filipino'
              ? `May natagpuang ${osmCount} kalapit na pasilidad`
              : `Found ${osmCount} nearby emergency facilities`)
          : t('verifiedHubs')
      );
    } else {
      setOsmStatus(t('verifiedHubs'));
    }
    setLoadingOsm(false);
  }, [lang, t]);

  const loadCenters = useCallback(
    () => fetchNearbyOsmEmergencyCenters(lat, lng).catch(() => null),
    [lat, lng]
  );

  // Manual refresh button
  const discoverNearbyViaOsm = useCallback(() => {
    setLoadingOsm(true);
    return loadCenters().then(applyOsmResult);
  }, [loadCenters, applyOsmResult]);

  // Auto-discover when coordinates change
  useEffect(() => {
    let active = true;
    loadCenters().then((list) => {
      if (active) applyOsmResult(list);
    });
    return () => {
      active = false;
    };
  }, [loadCenters, applyOsmResult]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.brand} />

      <View style={styles.innerHeader}>
        <Text style={styles.innerHeaderTitle} accessibilityRole="header">{t('liveLocationTitle')}</Text>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.medScroll} showsVerticalScrollIndicator={false}>

        {/* Error Handling Banner if GPS is disabled, denied, or signal lost (Table 1.6) */}
        {!hasRealGps && (
          <View style={styles.gpsWarningBanner} accessibilityLiveRegion="polite">
            <Ionicons name="warning" size={22} color={C.amberDark} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.amberDark, fontSize: 14, fontWeight: '800' }}>
                {gps.state === 'denied'
                  ? t('gpsWarningDenied')
                  : t('gpsWarningSearching')}
              </Text>
              <Text style={{ color: colors.textSec, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
                {Platform.OS === 'web'
                  ? (lang === 'Filipino'
                      ? 'Pinaghihigpitan ng mga mobile browser sa HTTP LAN ang hardware GPS. Ipinapakita ang fallback na lokasyon sa Parañaque City.'
                      : 'Mobile browsers over HTTP LAN restrict hardware GPS. Showing Parañaque City fallback location for testing.')
                  : (lang === 'Filipino'
                      ? 'Pakibuksan ang Location Services upang makita ng mga CSN responder ang iyong eksaktong lugar sa oras ng emergency.'
                      : 'Please enable Location Services so CSN responders can track your exact position during an emergency.')}
              </Text>
              <View style={[styles.row, { marginTop: 8, gap: 10 }]}>
                <Pressable onPress={onRefreshGps} style={styles.gpsRetryBtn}>
                  <Ionicons name="refresh" size={14} color={C.white} style={{ marginRight: 4 }} />
                  <Text style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>{t('gpsRetryBtn')}</Text>
                </Pressable>
                {Platform.OS !== 'web' && (
                  <Pressable onPress={openAppSettings} style={[styles.gpsRetryBtn, { backgroundColor: C.white, borderWidth: 1, borderColor: C.amberDark }]}>
                    <Text style={{ color: C.amberDark, fontSize: 12, fontWeight: '700' }}>{t('openSettingsShort')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Live Location Toggle Card (Table 1.6: Start / Stop real-time location sharing) */}
        <SectionCard>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={[styles.row, { flex: 1, marginRight: 12 }]}>
              <View
                style={[
                  styles.supportIconCircle,
                  { backgroundColor: liveSharing ? C.successLight : (isDark ? colors.border : C.border) },
                ]}
              >
                <Ionicons
                  name={liveSharing ? 'radio' : 'locate-outline'}
                  size={22}
                  color={liveSharing ? C.successDark : C.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                  {liveSharing ? t('coordStreamingOn') : t('coordStreamingOff')}
                </Text>
                <Text style={{ color: colors.textSec, fontSize: 13, marginTop: 2 }}>
                  {liveSharing
                    ? t('coordDesc')
                    : t('coordDescOff')}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onToggleLiveSharing}
              accessibilityRole="switch"
              accessibilityState={{ checked: liveSharing }}
              accessibilityLabel="Toggle live location streaming"
              style={[styles.toggleTrack, liveSharing && styles.toggleTrackActive]}
            >
              <View style={[styles.toggleThumb, liveSharing && styles.toggleThumbActive]} />
            </Pressable>
          </View>

          <View style={[styles.coordBox, isDark && { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                {t('currentCoords')}
              </Text>
              <Text style={[styles.coordText, { fontSize: 14, lineHeight: 19, marginTop: 2 }, isDark && { color: colors.text }]}>
                {locationName}
              </Text>
            </View>
            <PrimaryButton
              title={liveSharing ? t('stopSharing') : t('startSharing')}
              tone={liveSharing ? 'critical' : 'brand'}
              icon={liveSharing ? 'stop-circle-outline' : 'play-circle-outline'}
              onPress={onToggleLiveSharing}
              style={{ minHeight: 42, paddingHorizontal: 14 }}
            />
          </View>
        </SectionCard>

        {/* Interactive Map View (Table 1.6: OpenStreetMap + Leaflet) */}
        <Text style={[styles.sectionHeading, isDark && { color: colors.brand }]}>{t('interactiveMap')}</Text>
        <InteractiveLocationMap
          coords={effectiveCoords}
          isStreaming={liveSharing}
          centers={centers}
          selectedCenter={selectedCenter}
          onSelectCenter={setSelectedCenter}
          childName={child && child.name}
          locationName={locationName}
          navigationTrigger={navTrigger}
        />

        {/* Nearby Emergency Centers List (Parañaque Hubs + Live OpenStreetMap Overpass Results) */}
        <View style={[styles.row, { justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionHeading, { marginBottom: 2, marginTop: 0 }, isDark && { color: colors.brand }]}>
              {t('nearbyCenters')} ({centers.length})
            </Text>
            <Text style={{ color: colors.textSec, fontSize: 12 }}>{osmStatus || t('verifiedHubs')}</Text>
          </View>
          <Pressable
            onPress={discoverNearbyViaOsm}
            disabled={loadingOsm}
            accessibilityRole="button"
            accessibilityLabel="Refresh nearby emergency centers"
            style={[styles.leafletToolBtn, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {loadingOsm ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <>
                <Ionicons name="refresh" size={14} color={colors.brand} style={{ marginRight: 4 }} />
                <Text style={[styles.leafletToolBtnText, { color: colors.brand }]}>{t('refreshBtn')}</Text>
              </>
            )}
          </Pressable>
        </View>

        {centers.map((center) => {
          const dist = calcDistanceKm(
            effectiveCoords.latitude,
            effectiveCoords.longitude,
            center.latitude,
            center.longitude
          );
          const active = selectedCenter && selectedCenter.id === center.id;
          return (
            <View
              key={center.id}
              style={[
                styles.facilityCard,
                isDark && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                active && { borderColor: colors.brand, borderWidth: 2, backgroundColor: isDark ? '#0C4A6E' : '#F0F9FF' },
              ]}
            >
              <Pressable
                onPress={() => setSelectedCenter(center)}
                accessibilityRole="button"
                accessibilityLabel={`Focus map on ${center.name}`}
                style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}
              >
                <View style={[styles.row, { flex: 1 }]}>
                  <View style={[styles.supportIconCircle, { backgroundColor: center.color + '18' }]}>
                    <Ionicons name={center.icon} size={20} color={center.color} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{center.name}</Text>
                      {center.isOsmLive && (
                        <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: '#166534', fontSize: 9, fontWeight: '800' }}>OSM LIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: colors.textSec, fontSize: 12, marginTop: 2 }}>
                      {center.type} • {center.address}
                    </Text>
                  </View>
                </View>
                {dist != null && (
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>{dist.toFixed(1)} km</Text>
                  </View>
                )}
              </Pressable>

              <View style={[styles.row, { gap: 8, marginTop: 8 }]}>
                <Pressable
                  onPress={() => setSelectedCenter(center)}
                  accessibilityRole="button"
                  style={[
                    styles.facilityActionBtn,
                    {
                      backgroundColor: active ? colors.brand : (isDark ? colors.bg : C.bg),
                      borderWidth: 1,
                      borderColor: colors.brand,
                    },
                  ]}
                >
                  <Ionicons name="locate" size={15} color={active ? C.white : colors.brand} style={{ marginRight: 5 }} />
                  <Text style={{ color: active ? C.white : colors.brand, fontSize: 12, fontWeight: '800' }}>
                    {active
                      ? (lang === 'Filipino' ? 'Naka-focus sa Mapa' : 'Focused on Map')
                      : (lang === 'Filipino' ? 'Ipakita sa Mapa' : 'Show on Map')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => callEmergencyNumber(center.phone)}
                  accessibilityRole="button"
                  style={[styles.facilityActionBtn, { backgroundColor: center.color }]}
                >
                  <Ionicons name="call" size={14} color={C.white} style={{ marginRight: 5 }} />
                  <Text style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>{t('callBtn')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSelectedCenter(center);
                    setNavTrigger({ center, timestamp: Date.now() });
                    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
                  }}
                  accessibilityRole="button"
                  style={[styles.facilityActionBtn, { backgroundColor: isDark ? colors.brandLight : C.brandLight }]}
                >
                  <Ionicons name="navigate" size={14} color={colors.brand} style={{ marginRight: 5 }} />
                  <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}>{t('navBtn')}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <BottomTabBar current="location" onPress={(k) => go(k)} unread={unread} />
    </SafeAreaView>
  );
}
