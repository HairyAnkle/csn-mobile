import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';

import { useApp } from '../context/AppContext';
import { DispatchStepper } from '../components/DispatchStepper';
import { InteractiveLocationMap } from '../components/InteractiveLocationMap';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCard } from '../components/SectionCard';
import { DEFAULT_PARANAQUE_COORDS, EMERGENCY_NUMBER } from '../constants/app';
import { NEARBY_EMERGENCY_CENTERS } from '../constants/data';
import { C } from '../theme/colors';
import { styles } from '../theme/styles';
import { callEmergencyNumber } from '../utils/device';
import { useLocationName } from '../utils/geo';

export function EmergencyActiveScreen({
  emergency,
  coords,
  liveSharing,
  onToggleLiveSharing,
  onArrived,
  confirmingArrival = false,
  onCancel,
  onDone,
  cancelling,
}) {
  const { isDark, colors, lang, t } = useApp();
  const isFil = lang === 'Filipino';
  const [cancelOpen, setCancelOpen] = useState(false);
  const [arrivedOpen, setArrivedOpen] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(NEARBY_EMERGENCY_CENTERS[0]);

  const status    = emergency ? emergency.status : 'pending';
  const urgency   = emergency && emergency.urgency ? emergency.urgency : 'high';
  const isArrived = status === 'arrived';
  const done      = status === 'resolved' || status === 'cancelled';
  const screenBg  =
    status === 'resolved' || isArrived ? C.successDark :
    status === 'cancelled' ? C.textSec :
    status === 'responding' ? C.amberDark :
    C.critical;

  const headline =
    status === 'resolved'  ? (isFil ? 'Nalutas na ang Emergency ✓' : 'Emergency Resolved ✓') :
    isArrived              ? (isFil ? 'Dumating na ang Responder ✓' : 'Responder Arrived on Scene ✓') :
    status === 'cancelled' ? (isFil ? 'Kinansela ang Alerto' : 'Alert Cancelled') :
    status === 'responding'? (isFil ? 'Papunta na ang Tulong' : 'Help Is On The Way') :
    (isFil ? 'Naipadala ang Alerto' : 'Alert Dispatched');

  const subline =
    status === 'pending'   ? (isFil ? 'Ipinapadala sa CSN Admin at mga Responder ng Parañaque DRRMO...' : 'Broadcasting to CSN Admin & Parañaque DRRMO Responders...') :
    status === 'responding'? (isFil ? 'Tinanggap ng responder ang iyong alerto at papunta na.' : 'A responder has accepted your alert and is en route.') :
    isArrived              ? (isFil ? 'Nakumpirma ang pagdating ng responder! Naabisuhan ang CSN Admin at Tagapag-alaga.' : 'Responder arrival confirmed! CSN Admin & Guardian are notified.') :
    status === 'resolved'  ? (isFil ? 'Minarkahan ng CSN team ang insidenteng ito bilang nalutas.' : 'The CSN team has marked this incident as resolved.') :
    (isFil ? 'Kinansela ang alertong ito.' : 'This alert was cancelled.');

  const responder = emergency && emergency.responder;
  const effectiveCoords = coords || (emergency && emergency.lat ? { latitude: emergency.lat, longitude: emergency.lng } : DEFAULT_PARANAQUE_COORDS);
  const locationName = useLocationName(
    effectiveCoords.latitude,
    effectiveCoords.longitude,
    emergency?.facility_room ? `CSN Center Parañaque — ${emergency.facility_room}` : emergency?.location,
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: screenBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={screenBg} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Banner ── */}
        <View style={styles.activeBanner} accessibilityLiveRegion="assertive">
          <View style={styles.activeBannerIcon}>
            <Ionicons
              name={status === 'resolved' || isArrived ? 'checkmark-circle' : status === 'cancelled' ? 'close-circle' : 'warning'}
              size={48}
              color={C.white}
            />
          </View>
          <Text style={styles.activeHeadline}>{headline}</Text>
          <Text style={styles.activeSub}>{subline}</Text>
          <View style={[styles.row, { marginTop: 10, gap: 8, flexWrap: 'wrap', justifyContent: 'center' }]}>
            <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
              <Text style={[styles.badgeText, { color: C.white }]}>
                {urgency === 'high' ? '⚡ HIGH URGENCY (DRRMO + CSN)' : 'LOW URGENCY (CSN CENTER)'}
              </Text>
            </View>
            {emergency && emergency.reported_by_role === 'teacher' && (
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={[styles.badgeText, { color: C.white }]}>
                  🏫 CSN TEACHER ALERT
                </Text>
              </View>
            )}
          </View>
          {!done && !isArrived && <ActivityIndicator color="rgba(255,255,255,0.7)" style={{ marginTop: 10 }} />}
        </View>

        {/* ── Dispatch Stepper ── */}
        <SectionCard style={{ marginBottom: 12 }}>
          <Text style={[styles.activeCardLabel, isDark && { color: colors.muted }]}>{t('dispatchProgressLabel')}</Text>
          <DispatchStepper status={status} />
          {emergency && (emergency.child?.name || emergency.facility_room) && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: isDark ? colors.bg : C.brandLight, borderRadius: 10 }}>
              {!!emergency.child?.name && (
                <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '800' }}>
                  Student: {emergency.child.name}
                  {emergency.child.disability ? ` (${emergency.child.disability})` : ''}
                </Text>
              )}
              {!!emergency.facility_room && (
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                  Location: CSN Center Parañaque — {emergency.facility_room}
                </Text>
              )}
            </View>
          )}
          {emergency && (emergency.message || emergency.guardian_notes) ? (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: isDark ? colors.bg : C.bg, borderRadius: 10, borderWidth: isDark ? 1 : 0, borderColor: colors.border }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>{t('submittedMessageLabel')}</Text>
              <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }}>
                &ldquo;{emergency.message || emergency.guardian_notes}&rdquo;
              </Text>
            </View>
          ) : null}
        </SectionCard>

        {/* ── Interactive Live Map & GPS Transmission Toggle (Table 1.6) ── */}
        <SectionCard style={{ marginBottom: 12 }}>
          <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
            <View style={[styles.row, { flex: 1 }]}>
              <Ionicons
                name="navigate-circle"
                size={22}
                color={done || !liveSharing ? colors.muted : colors.success}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activeCardTitle, isDark && { color: colors.text }]}>
                  {done
                    ? (isFil ? 'Huminto ang pagbahagi ng lokasyon' : 'Location sharing stopped')
                    : liveSharing
                    ? (isFil ? 'Aktibo ang live na pagbabahagi ng lokasyon' : 'Streaming live GPS location')
                    : (isFil ? 'Naka-pause ang live GPS streaming' : 'Live GPS streaming paused')}
                </Text>
                <Text style={[styles.coordText, isDark && { color: colors.text }]}>
                  {locationName}
                </Text>
              </View>
            </View>
            {!done && (
              <Pressable
                onPress={onToggleLiveSharing}
                accessibilityRole="switch"
                accessibilityState={{ checked: liveSharing }}
                style={[styles.toggleTrack, liveSharing && styles.toggleTrackActive]}
              >
                <View style={[styles.toggleThumb, liveSharing && styles.toggleThumbActive]} />
              </Pressable>
            )}
          </View>

          <InteractiveLocationMap
            coords={effectiveCoords}
            isStreaming={!done && liveSharing}
            selectedCenter={selectedCenter}
            onSelectCenter={setSelectedCenter}
            childName={isFil ? 'Lokasyon ng Emergency' : 'Emergency Location'}
            locationName={locationName}
          />
        </SectionCard>

        {/* ── Responder Card ── */}
        <SectionCard style={{ marginBottom: 16 }}>
          <Text style={[styles.activeCardLabel, isDark && { color: colors.muted }]}>{t('assignedResponderLabel')}</Text>
          {responder ? (
            <View style={[styles.row, { marginTop: 10 }]}>
              <View style={[styles.responderIcon, isDark && { backgroundColor: isDark ? '#0C4A6E' : C.brandLight }]}>
                <Ionicons name="car-sport" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.responderName, isDark && { color: colors.text }]}>
                  {responder.unit || responder.name || 'Parañaque Emergency Unit'}
                </Text>
                <Text style={[styles.responderMeta, isDark && { color: colors.textSec }]}>
                  {status === 'resolved' || isArrived ? (isFil ? 'Dumating na sa Lugar' : 'Arrived on Scene') : (isFil ? 'Papunta na' : 'En Route')}
                  {responder.eta && !isArrived ? ` · ETA ${responder.eta}` : ''}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.row, { marginTop: 10 }]}>
              <View style={[styles.responderIcon, isDark && { backgroundColor: colors.border }]}>
                <Ionicons name="time-outline" size={22} color={colors.muted} />
              </View>
              <Text style={[styles.responderMeta, { flex: 1, marginLeft: 12 }, isDark && { color: colors.textSec }]}>
                {done ? (isFil ? 'Walang naitalagang responder.' : 'No responder was assigned.') : (isFil ? 'Nagtatalaga ng pinakamalapit na unit ng Parañaque responder…' : 'Assigning nearest Parañaque responder unit…')}
              </Text>
            </View>
          )}
        </SectionCard>

        {/* ── Mobile User "Responder Arrived" Confirmation Button (Notifies Admin & Users) ── */}
        {(status === 'pending' || status === 'responding') && onArrived && (
          <Pressable
            onPress={() => setArrivedOpen(true)}
            disabled={confirmingArrival}
            accessibilityRole="button"
            accessibilityLabel="Confirm responder has arrived"
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#10B981',
                borderRadius: 14,
                minHeight: 54,
                paddingHorizontal: 16,
                marginBottom: 12,
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.7)',
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 6,
              },
              pressed && { opacity: 0.88 },
            ]}
          >
            <Ionicons name="flag" size={20} color={C.white} style={{ marginRight: 8 }} />
            <Text style={{ color: C.white, fontSize: 16, fontWeight: '900' }}>
              {t('responderArrivedBtn')}
            </Text>
          </Pressable>
        )}

        {isArrived && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.45)',
              gap: 10,
            }}
          >
            <Ionicons name="checkmark-circle" size={24} color={C.white} />
            <Text style={{ color: C.white, fontSize: 14, fontWeight: '800', flex: 1 }}>
              {isFil
                ? 'Nakumpirma ang pagdating ng responder — naabisuhan ang CSN Admin at Tagapag-alaga/Guro.'
                : 'Responder arrival confirmed — CSN Admin & Guardian/Teacher notified.'}
            </Text>
          </View>
        )}

        {/* ── Call 911 ── */}
        <Pressable
          onPress={() => callEmergencyNumber(EMERGENCY_NUMBER)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${EMERGENCY_NUMBER}`}
          style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="call" size={20} color={C.critical} style={{ marginRight: 8 }} />
          <Text style={styles.callBtnText}>{isFil ? `Tumawag sa ${EMERGENCY_NUMBER}` : `Call ${EMERGENCY_NUMBER}`}</Text>
        </Pressable>

        {/* ── Done / Cancel ── */}
        {done || isArrived ? (
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            style={[styles.ghostBtn, { marginTop: 12 }]}
          >
            <Text style={styles.ghostBtnText}>{t('backToDashboard')}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setCancelOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Cancel alert, false alarm"
            style={[styles.ghostBtn, { marginTop: 12 }]}
          >
            <Text style={styles.ghostBtnText}>{t('cancelAlertFalseAlarm')}</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Responder Arrived confirmation modal */}
      <Modal visible={arrivedOpen} transparent animationType="fade" onRequestClose={() => setArrivedOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, isDark && { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={[styles.modalIconCircle, { backgroundColor: C.successLight }]}>
              <Ionicons name="flag" size={30} color={C.successDark} />
            </View>
            <Text style={[styles.modalTitle, isDark && { color: colors.text }]}>{t('confirmArrivedTitle')}</Text>
            <Text style={[styles.modalBody, isDark && { color: colors.textSec }]}>
              {t('confirmArrivedBody')}
            </Text>
            <PrimaryButton
              title={t('confirmArrivedYes')}
              tone="brand"
              icon="checkmark-circle"
              loading={confirmingArrival}
              onPress={async () => {
                const ok = await onArrived();
                if (ok) setArrivedOpen(false);
              }}
              style={{ backgroundColor: C.successDark }}
            />
            <PrimaryButton
              title={t('confirmArrivedNo')}
              tone="ghost"
              onPress={() => setArrivedOpen(false)}
              style={{ marginTop: 10 }}
              disabled={confirmingArrival}
            />
          </View>
        </View>
      </Modal>

      {/* Cancel confirmation modal */}
      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, isDark && { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isDark && { color: colors.text }]}>
              {isFil ? 'Kanselahin ang alertong ito?' : 'Cancel this alert?'}
            </Text>
            <Text style={[styles.modalBody, isDark && { color: colors.textSec }]}>
              {isFil
                ? 'Kanselahin lamang kung ligtas ang lahat. Aabisuhan ang mga paparating na responder na ito ay maling alarma lamang.'
                : 'Only cancel if everyone is safe. Responders already en route will be notified it was a false alarm.'}
            </Text>
            <PrimaryButton
              title={isFil ? 'Oo, maling alarma lamang ito' : 'Yes, it was a false alarm'}
              tone="critical"
              loading={cancelling}
              onPress={async () => {
                const ok = await onCancel();
                if (ok) setCancelOpen(false);
              }}
            />
            <PrimaryButton
              title={isFil ? 'Hindi, panatilihing aktibo ang alerto' : 'No, keep the alert active'}
              tone="ghost"
              onPress={() => setCancelOpen(false)}
              style={{ marginTop: 10 }}
              disabled={cancelling}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
