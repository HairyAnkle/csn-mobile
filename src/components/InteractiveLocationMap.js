import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { DEFAULT_PARANAQUE_COORDS } from '../constants/app';
import { NEARBY_EMERGENCY_CENTERS } from '../constants/data';
import { buildLeafletMapHtml } from '../services/leafletMapHtml';
import { C } from '../theme/colors';
import { styles } from '../theme/styles';
import { useLocationName } from '../utils/geo';

let NativeWebView = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch {
    NativeWebView = null;
  }
}

/**
 * Interactive OpenStreetMap + Leaflet Map Card (Table 1.6)
 * Works on Web (via <iframe>) and Native iOS/Android (via <WebView>).
 * Uses purely open-source OpenStreetMap + Leaflet + OSRM routing (no Google/Apple Maps redirects).
 */
export function InteractiveLocationMap({
  coords,
  isStreaming,
  centers = NEARBY_EMERGENCY_CENTERS,
  selectedCenter,
  onSelectCenter,
  childName,
  locationName,
  navigationTrigger,
}) {
  const { colors, t, lang } = useApp();
  const lat = coords ? coords.latitude : DEFAULT_PARANAQUE_COORDS.latitude;
  const lng = coords ? coords.longitude : DEFAULT_PARANAQUE_COORDS.longitude;
  const resolvedLocationName = useLocationName(lat, lng, locationName);

  const iframeRef = useRef(null);
  const webViewRef = useRef(null);
  const modalIframeRef = useRef(null);
  const modalWebViewRef = useRef(null);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);

  const selectedId = selectedCenter ? selectedCenter.id : centers[0]?.id;

  const postToRef = (targetIframe, targetWebView, str) => {
    if (Platform.OS === 'web') {
      if (targetIframe.current && targetIframe.current.contentWindow) {
        targetIframe.current.contentWindow.postMessage(str, '*');
      }
    } else if (targetWebView.current && typeof targetWebView.current.postMessage === 'function') {
      targetWebView.current.postMessage(str);
    }
  };

  // Send command to embedded & modal Leaflet maps
  const sendCommandToLeaflet = useCallback((cmdObj) => {
    const str = JSON.stringify(cmdObj);
    postToRef(iframeRef, webViewRef, str);
    postToRef(modalIframeRef, modalWebViewRef, str);
  }, []);

  useEffect(() => {
    if (selectedCenter) {
      sendCommandToLeaflet({ type: 'FOCUS_CENTER', center: selectedCenter });
    }
  }, [selectedCenter, sendCommandToLeaflet]);

  const [prevNavTimestamp, setPrevNavTimestamp] = useState(navigationTrigger?.timestamp || 0);
  const nextNavTimestamp = navigationTrigger?.timestamp || 0;
  if (nextNavTimestamp !== prevNavTimestamp) {
    setPrevNavTimestamp(nextNavTimestamp);
    if (navigationTrigger?.center) {
      setFullScreenOpen(true);
    }
  }

  useEffect(() => {
    if (navigationTrigger?.center) {
      const cmd = { type: 'NAVIGATE_CENTER', center: navigationTrigger.center };
      sendCommandToLeaflet(cmd);
      const timer = setTimeout(() => sendCommandToLeaflet(cmd), 350);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [navigationTrigger, sendCommandToLeaflet]);

  // Listen for marker clicks from Web iframe
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onMsg = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data && data.type === 'SELECT_CENTER' && data.id && onSelectCenter) {
          const found = centers.find((c) => c.id === data.id);
          if (found) onSelectCenter(found);
        }
      } catch {}
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [centers, onSelectCenter]);

  const latKey = lat.toFixed(4);
  const lngKey = lng.toFixed(4);
  const centerCount = centers.length;

  const mapHtml = useMemo(
    () =>
      buildLeafletMapHtml({
        userLat: lat,
        userLng: lng,
        isStreaming,
        childName: childName ? `${childName} (${lang === 'Filipino' ? 'Ikaw' : 'You'})` : (lang === 'Filipino' ? 'Iyong Lokasyon' : 'Your Location'),
        locationName: resolvedLocationName,
        centers,
        selectedId,
      }),
    // Rebuild initial HTML when coordinates, location name, streaming state, or discovered centers list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latKey, lngKey, resolvedLocationName, isStreaming, childName, centerCount, lang]
  );

  const renderMapFrame = (frameRef, webRef) => {
    if (Platform.OS === 'web') {
      return (
        <iframe
          ref={frameRef}
          title="Parañaque CSN OpenStreetMap Leaflet View"
          srcDoc={mapHtml}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      );
    }
    if (NativeWebView) {
      return (
        <NativeWebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={{ flex: 1, width: '100%', height: '100%' }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data && data.type === 'SELECT_CENTER' && data.id && onSelectCenter) {
                const found = centers.find((c) => c.id === data.id);
                if (found) onSelectCenter(found);
              }
            } catch {}
          }}
        />
      );
    }
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Ionicons name="map" size={36} color={C.brand} />
        <Text style={{ color: C.text, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
          {resolvedLocationName}
        </Text>
      </View>
    );
  };

  return (
    <>
      <View style={styles.mapContainer}>
        {/* Top Status & Map Controls Bar */}
        <View style={styles.leafletToolbar}>
          <View style={[styles.row, { flex: 1 }]}>
            <View style={[styles.gpsDot, { backgroundColor: isStreaming ? C.success : C.muted, marginRight: 6 }]} />
            <Text style={{ color: C.text, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
              {isStreaming ? t('gpsLiveActive') : t('gpsPaused')}
            </Text>
          </View>
          <View style={[styles.row, { gap: 6 }]}>
            <Pressable
              onPress={() => sendCommandToLeaflet({ type: 'RECENTER_USER' })}
              accessibilityRole="button"
              accessibilityLabel="Center map on my GPS position"
              style={styles.leafletToolBtn}
            >
              <Ionicons name="locate" size={14} color={C.brand} style={{ marginRight: 3 }} />
              <Text style={styles.leafletToolBtnText}>{t('myGpsBtn')}</Text>
            </Pressable>
            <Pressable
              onPress={() => sendCommandToLeaflet({ type: 'FIT_ALL' })}
              accessibilityRole="button"
              accessibilityLabel="Show all nearby emergency centers"
              style={styles.leafletToolBtn}
            >
              <Ionicons name="scan-outline" size={14} color={C.brand} style={{ marginRight: 3 }} />
              <Text style={styles.leafletToolBtnText}>{t('fitAllBtn')}</Text>
            </Pressable>
          </View>
        </View>

        {/* Interactive Leaflet Map Surface */}
        <View style={styles.mapCanvas}>
          {renderMapFrame(iframeRef, webViewRef)}
        </View>

        {/* Footer Bar with in-app OpenStreetMap + Leaflet Full-Screen Navigation launcher */}
        <View style={styles.osmBar}>
          <Ionicons name="navigate-circle-outline" size={16} color={C.brand} style={{ marginRight: 6 }} />
          <Text style={{ flex: 1, fontSize: 12, color: C.textSec }} numberOfLines={1}>
            {t('mapFooterHint')}
          </Text>
          <Pressable
            onPress={() => setFullScreenOpen(true)}
            accessibilityRole="button"
          >
            <Text style={{ color: C.brand, fontSize: 12, fontWeight: '800' }}>{t('fullMapBtn')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Full-Screen In-App OpenStreetMap + Leaflet Navigation Modal */}
      <Modal
        visible={fullScreenOpen}
        animationType="slide"
        onRequestClose={() => setFullScreenOpen(false)}
      >
        <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: C.brand,
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: C.white, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                {selectedCenter ? selectedCenter.name : 'OpenStreetMap Navigation'}
              </Text>
              <Text style={{ color: '#BAE6FD', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {lang === 'Filipino' ? 'Gamit ang Leaflet + OpenStreetMap' : 'Powered by Leaflet + OpenStreetMap'}
              </Text>
            </View>
            <View style={[styles.row, { gap: 8 }]}>
              {selectedCenter && (
                <Pressable
                  onPress={() => sendCommandToLeaflet({ type: 'NAVIGATE_CENTER', center: selectedCenter })}
                  style={styles.headerActionBtn}
                >
                  <Ionicons name="navigate" size={14} color={C.white} style={{ marginRight: 4 }} />
                  <Text style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>
                    {lang === 'Filipino' ? 'Ruta' : 'Route'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setFullScreenOpen(false)}
                style={styles.headerActionBtn}
                accessibilityRole="button"
                accessibilityLabel="Close full-screen map"
              >
                <Ionicons name="close" size={18} color={C.white} />
              </Pressable>
            </View>
          </View>

          <View style={{ flex: 1, backgroundColor: '#E2E8F0' }}>
            {renderMapFrame(modalIframeRef, modalWebViewRef)}
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
              {t('currentCoords')}
            </Text>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>
              {resolvedLocationName}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
