import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useApp } from '../context/AppContext';
import { BottomTabBar } from '../components/BottomTabBar';
import { Field } from '../components/Field';
import { HoldToConfirm } from '../components/HoldToConfirm';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCard } from '../components/SectionCard';
import { CSN_HOTLINE, EMERGENCY_NUMBER, USE_NATIVE_DRIVER } from '../constants/app';
import { CSN_FACILITY_ROOMS, getEmergencyTypes, getStatusStyle } from '../constants/data';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { C, SOS_SIZE } from '../theme/colors';
import { styles } from '../theme/styles';
import { callEmergencyNumber, openAppSettings } from '../utils/device';
import { formatDisabilitySummary } from '../utils/format';
import { resolveParanaqueLocationName } from '../utils/geo';

/* ============================================================================
 * SCREEN 4 & 5 — HOME / DASHBOARD (Table 1.4) & EMERGENCY TRIGGER FLOW (Table 1.5)
 * ========================================================================== */

export function DashboardScreen({
  guardian,
  child,
  childrenList = [],
  activeEmergency = null,
  onOpenActiveEmergency,
  onConfirmArrived,
  confirmingArrival = false,
  initialSelectedChildId = null,
  initialOpenTrigger = false,
  gps,
  coords,
  go,
  onTrigger,
  triggering,
  triggerError,
  clearTriggerError,
  unread,
}) {
  const { isDark, colors, t, lang } = useApp();
  const isFil = lang === 'Filipino';
  const emergencyTypes = getEmergencyTypes(lang);
  const activeStatusStyle = activeEmergency ? getStatusStyle(activeEmergency.status, lang) : getStatusStyle('pending', lang);
  const isTeacher = Boolean(guardian && guardian.role === 'teacher');

  const [confirmOpen, setConfirmOpen]           = useState(Boolean(initialOpenTrigger));
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [contactsOpen, setContactsOpen]         = useState(false);
  const [selectedChildId, setSelectedChildId]   = useState(initialSelectedChildId);
  const [studentSearch, setStudentSearch]       = useState('');
  const [facilityRoom, setFacilityRoom]         = useState(CSN_FACILITY_ROOMS[0]);
  const [teacherValidationErr, setTeacherValidationErr] = useState('');
  const [type, setType]                         = useState('medical_crisis');
  const [urgency, setUrgency]                   = useState('high'); // 'high' | 'low'
  const [message, setMessage]                   = useState('');
  const [shareLocation, setShareLocation]       = useState(true);

  const [prevTriggerKey, setPrevTriggerKey] = useState(`${initialSelectedChildId || ''}:${initialOpenTrigger ? '1' : '0'}`);
  const nextTriggerKey = `${initialSelectedChildId || ''}:${initialOpenTrigger ? '1' : '0'}`;
  if (nextTriggerKey !== prevTriggerKey) {
    setPrevTriggerKey(nextTriggerKey);
    if (initialSelectedChildId) setSelectedChildId(initialSelectedChildId);
    if (initialOpenTrigger) setConfirmOpen(true);
  }

  // SOS outer ring pulse animation
  const ring1 = useAnimatedValue(1);
  const ring2 = useAnimatedValue(1);
  const ringOpacity1 = useAnimatedValue(0.6);
  const ringOpacity2 = useAnimatedValue(0.4);

  useEffect(() => {
    const pulse = (scale, opacity, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1.55, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(opacity, { toValue: 0,    duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
            Animated.timing(opacity, { toValue: delay === 0 ? 0.6 : 0.4, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
          ]),
        ])
      );
    const l1 = pulse(ring1, ringOpacity1, 0);
    const l2 = pulse(ring2, ringOpacity2, 600);
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, [ring1, ring2, ringOpacity1, ringOpacity2]);

  const gpsInfo =
    gps.state === 'active'
      ? { text: t('activeReady'), detail: isFil ? 'Aktibo at ligtas ang live na lokasyon' : 'Live location active & secured', color: C.successDark, bg: C.successLight, icon: 'location' }
      : gps.state === 'denied'
      ? {
          text: Platform.OS === 'web'
            ? (isFil ? 'Handa ang GPS (Simulated sa LAN)' : 'GPS Ready (Simulated on LAN)')
            : (isFil ? 'Naka-off ang GPS — I-tap para Buksan' : 'GPS Off — Tap to Enable'),
          detail: Platform.OS === 'web'
            ? (isFil ? 'Gumagamit ng test coordinates ng Parañaque CSN' : 'Using Parañaque CSN test coordinates')
            : (isFil ? 'I-tap upang buksan ang settings ng lokasyon' : 'Tap to open location settings'),
          color: Platform.OS === 'web' ? C.amberDark : C.criticalDark,
          bg: Platform.OS === 'web' ? C.amberLight : C.criticalLight,
          icon: 'location-outline',
        }
      : { text: t('loading'), detail: isFil ? 'Naghahanap ng signal ng GPS' : 'Finding satellite lock', color: C.amberDark, bg: C.amberLight, icon: 'locate' };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setFinalConfirmOpen(false);
    setTeacherValidationErr('');
    clearTriggerError();
  };

  const selectedStudent = childrenList.find((c) => String(c.id) === String(selectedChildId)) || null;

  const filteredStudents = childrenList.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.disability || s.condition || '').toLowerCase().includes(q) ||
      (s.guardian_name || '').toLowerCase().includes(q)
    );
  });

  const validateTeacherAlert = () => {
    if (!isTeacher) return true;
    if (!selectedStudent) {
      setTeacherValidationErr(isFil ? 'Piliin muna ang estudyanteng sangkot sa emergency.' : 'Please select the student involved in the emergency.');
      return false;
    }
    if (!facilityRoom) {
      setTeacherValidationErr(isFil ? 'Piliin muna kung saang pasilidad o silid sa CSN Center nangyari ang insidente.' : 'Please select which CSN Center facility / room the episode happened in.');
      return false;
    }
    setTeacherValidationErr('');
    return true;
  };

  const handleDispatch = () => {
    if (!validateTeacherAlert()) return;
    setFinalConfirmOpen(false);
    onTrigger({
      type,
      urgency,
      message: message.trim(),
      shareLocation,
      childId: isTeacher && selectedStudent ? selectedStudent.id : null,
      facilityRoom: isTeacher ? facilityRoom : null,
      location: isTeacher && facilityRoom ? `CSN Center Parañaque — ${facilityRoom}` : null,
    });
  };

  const hasActiveAlert = Boolean(
    activeEmergency &&
      activeEmergency.status !== 'resolved' &&
      activeEmergency.status !== 'cancelled'
  );

  const guardianName = guardian && guardian.name ? guardian.name.split(' ')[0] : (lang === 'Filipino' ? 'Tagapag-alaga' : (isTeacher ? 'Teacher' : 'Guardian'));
  const childInitials = child && child.name
    ? child.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : null;
  const disabilityBadge = formatDisabilitySummary(child);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.brand} />

      {/* ── Top Caregiver / Teacher Header (Table 1.4) ── */}
      <View style={styles.dashHeader}>
        {/* Child / Students avatar thumbnail */}
        <Pressable
          onPress={() => go('medical')}
          accessibilityRole="button"
          accessibilityLabel={isTeacher ? 'Open student profiles directory' : 'Open child medical profile'}
          style={childInitials && !isTeacher ? styles.childAvatar : [styles.childAvatar, { backgroundColor: C.brandDark }]}
        >
          {isTeacher ? (
            <Ionicons name="school" size={20} color={C.white} />
          ) : childInitials ? (
            <Text style={styles.childAvatarText}>{childInitials}</Text>
          ) : (
            <Ionicons name="person" size={20} color={C.white} />
          )}
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.dashGreeting}>{lang === 'Filipino' ? `Kumusta, ${guardianName} 👋` : `Hello, ${guardianName} 👋`}</Text>
          <Text style={styles.dashSubGreeting}>
            {isTeacher ? 'Parañaque CSN Center Teacher' : 'Parañaque CSN Caregiver'}
          </Text>
        </View>

        {/* Notification bell with badge count */}
        <Pressable
          onPress={() => go('inbox')}
          accessibilityRole="button"
          accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ''}`}
          style={styles.bellBtn}
        >
          <Ionicons name="notifications" size={23} color={C.white} />
          {unread > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>

        {/* Settings button (Table 1.10 access) */}
        <Pressable
          onPress={() => go('settings')}
          accessibilityRole="button"
          accessibilityLabel="App Settings"
          style={styles.bellBtn}
        >
          <Ionicons name="settings-outline" size={23} color={C.white} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.dashScroll} showsVerticalScrollIndicator={false}>

        {/* ── Active Emergency Banner (Shared for Parent & Teacher) ── */}
        {hasActiveAlert && (
          <View
            style={{
              backgroundColor: activeEmergency.status === 'arrived' ? C.successLight : '#FEF2F2',
              borderColor: activeEmergency.status === 'arrived' ? C.success : C.critical,
              borderWidth: 1.5,
              borderRadius: 18,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
              <View style={styles.row}>
                <Ionicons
                  name={activeEmergency.status === 'arrived' ? 'checkmark-circle' : 'warning'}
                  size={20}
                  color={activeEmergency.status === 'arrived' ? C.successDark : C.critical}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '900',
                    color: activeEmergency.status === 'arrived' ? C.successDark : C.criticalDark,
                    textTransform: 'uppercase',
                  }}
                >
                  {activeEmergency.status === 'arrived'
                    ? (isFil ? 'Dumating na ang Responder ✓' : 'Responder Arrived ✓')
                    : (isFil ? 'Aktibong Alertong Pang-Emergency' : 'Active Emergency Alert')}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: activeStatusStyle.bg,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: activeStatusStyle.fg,
                  }}
                >
                  {activeStatusStyle.label}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>
              {(activeEmergency.child && activeEmergency.child.name) || (child && child.name) || (isFil ? 'Estudyante' : 'Student')} •{' '}
              {(emergencyTypes.find((item) => item.key === activeEmergency.type) || {}).label || 'Emergency'}
            </Text>
            <Text style={{ fontSize: 12, color: C.textSec, marginTop: 3 }}>
              {activeEmergency.facility_room
                ? `CSN Center — ${activeEmergency.facility_room}`
                : activeEmergency.location && !String(activeEmergency.location).startsWith('Live GPS')
                ? activeEmergency.location
                : resolveParanaqueLocationName(activeEmergency.lat, activeEmergency.lng)}
              {activeEmergency.reported_by_role === 'teacher'
                ? (isFil ? ` • Iniulat ni ${activeEmergency.reported_by_name || 'Guro ng CSN'}` : ` • Reported by ${activeEmergency.reported_by_name || 'CSN Teacher'}`)
                : ''}
            </Text>

            <View style={[styles.row, { gap: 8, marginTop: 10 }]}>
              <Pressable
                onPress={onOpenActiveEmergency}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: 10,
                  backgroundColor: C.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: C.white, fontSize: 12, fontWeight: '800' }}>{isFil ? 'Tingnan ang Live Status' : 'View Live Status'}</Text>
              </Pressable>

              {activeEmergency.status !== 'arrived' && onConfirmArrived && (
                <Pressable
                  onPress={onConfirmArrived}
                  disabled={confirmingArrival}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    borderRadius: 10,
                    backgroundColor: C.successDark,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 10,
                    flexDirection: 'row',
                    gap: 4,
                    opacity: confirmingArrival ? 0.65 : 1,
                  }}
                >
                  {confirmingArrival ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <Ionicons name="flag" size={14} color={C.white} />
                  )}
                  <Text style={{ color: C.white, fontSize: 12, fontWeight: '800' }}>{isFil ? 'Dumating na ang Responder' : 'Responder Arrived'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Teacher Student Directory Card OR Guardian Child Summary Card ── */}
        {isTeacher ? (
          <SectionCard style={styles.childCard}>
            <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.childName, { color: colors.text }]}>
                  {isFil ? 'Mga Profile ng Estudyante ng CSN' : 'CSN Student Profiles'}
                </Text>
                <Text style={[styles.childAge, { color: colors.textSec }]}>
                  {isFil
                    ? `${childrenList.length} nakatalang profile ng Special Child • Piliin ang bata kung may episode`
                    : `${childrenList.length} enrolled Special Child profile${childrenList.length === 1 ? '' : 's'} • Select student in case of episode`}
                </Text>
              </View>
              <Pressable onPress={() => go('medical')} style={styles.mapQuickLink}>
                <Text style={[styles.mapQuickLinkText, { color: colors.brand }]}>
                  {isFil ? 'Lahat ng Profile →' : 'All Profiles →'}
                </Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.inputWrap,
                { marginBottom: 10, minHeight: 42 },
                isDark && { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                value={studentSearch}
                onChangeText={setStudentSearch}
                placeholder={isFil ? 'Maghanap ng pangalan ng bata o kondisyon...' : 'Search student name or condition...'}
                placeholderTextColor={colors.muted}
                style={[styles.inputInner, { fontSize: 14, color: colors.text }]}
              />
            </View>

            {filteredStudents.length === 0 ? (
              <Text style={{ color: colors.textSec, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
                {isFil ? 'Walang nahanap na profile ng estudyante.' : 'No matching student profiles found.'}
              </Text>
            ) : (
              filteredStudents.slice(0, 4).map((student) => {
                const isSelected = selectedStudent && String(selectedStudent.id) === String(student.id);
                const initials = (student.name || 'SC')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <Pressable
                    key={student.id}
                    onPress={() => setSelectedChildId(student.id)}
                    style={[
                      styles.contactModalRow,
                      {
                        marginBottom: 8,
                        backgroundColor: isSelected ? (isDark ? '#0C4A6E' : C.brandLight) : (isDark ? colors.bg : C.bg),
                        borderColor: isSelected ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.supportIconCircle,
                        { backgroundColor: isSelected ? colors.brand : C.brand + '18' },
                      ]}
                    >
                      <Text style={{ color: isSelected ? C.white : colors.brand, fontWeight: '900', fontSize: 13 }}>
                        {initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{student.name}</Text>
                      <Text style={{ color: colors.textSec, fontSize: 12 }} numberOfLines={1}>
                        {student.age != null ? `${student.age} ${isFil ? 'taong gulang' : 'yrs'} • ` : ''}
                        {student.disability || student.condition || (isFil ? 'May Espesyal na Pangangailangan' : 'Special Needs')}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? colors.brand : colors.muted}
                    />
                  </Pressable>
                );
              })
            )}

            {/* Live GPS status indicator */}
            <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }]}>
              <View style={[styles.gpsStatusPill, { backgroundColor: C.brandLight }]}>
                <Ionicons name="business" size={14} color={C.brand} style={{ marginRight: 4 }} />
                <Text style={[styles.gpsStatusText, { color: C.brand }]}>
                  {isFil ? 'Mode ng Pasilidad ng CSN Center' : 'CSN Center Facility Mode'}
                </Text>
              </View>
              <Pressable onPress={() => go('location')} style={styles.mapQuickLink}>
                <Ionicons name="map-outline" size={14} color={colors.brand} style={{ marginRight: 4 }} />
                <Text style={[styles.mapQuickLinkText, { color: colors.brand }]}>{t('viewLiveMap')}</Text>
              </Pressable>
            </View>
          </SectionCard>
        ) : (
        <SectionCard style={styles.childCard}>
          <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              {child && child.name ? (
                <>
                  <Text style={[styles.childName, { color: colors.text }]}>{child.name}</Text>
                  <Text style={[styles.childAge, { color: colors.textSec }]}>
                    {child.age != null ? `${child.age} ${isFil ? 'taong gulang' : 'yrs old'}` : (isFil ? 'Walang nakalagay na edad' : 'Age not set')}
                    {child.allergies && child.allergies !== 'None' ? ` • ${isFil ? 'Allergy' : 'Allergies'}: ${child.allergies}` : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.childName, { color: colors.text }]}>{t('noChildEnrolled')}</Text>
                  <Text style={[styles.childAge, { color: colors.textSec }]}>
                    {isFil
                      ? 'I-tap ang Impormasyong Medikal sa ibaba upang ilagay ang detalye ng anak'
                      : "Tap Medical Info below to add your child's details"}
                  </Text>
                </>
              )}
            </View>
            {disabilityBadge ? (
              <View style={[styles.disabilityChip, isDark && { backgroundColor: colors.brandLight }]}>
                <Text style={[styles.disabilityChipText, isDark && { color: colors.brand }]}>{disabilityBadge}</Text>
              </View>
            ) : null}
          </View>

          {/* Live GPS status indicator ("GPS Ready") */}
          <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }]}>
            <Pressable
              onPress={() => (gps.state === 'denied' && Platform.OS !== 'web' ? openAppSettings() : go('location'))}
              accessibilityRole="button"
              style={[styles.gpsStatusPill, { backgroundColor: gpsInfo.bg }]}
            >
              <View style={[styles.gpsDot, { backgroundColor: gpsInfo.color }]} />
              <Ionicons name={gpsInfo.icon} size={15} color={gpsInfo.color} style={{ marginRight: 4 }} />
              <Text style={[styles.gpsStatusText, { color: gpsInfo.color }]}>{gpsInfo.text}</Text>
            </Pressable>

            <Pressable
              onPress={() => go('location')}
              accessibilityRole="button"
              style={styles.mapQuickLink}
            >
              <Ionicons name="map-outline" size={14} color={colors.brand} style={{ marginRight: 4 }} />
              <Text style={[styles.mapQuickLinkText, { color: colors.brand }]}>{t('viewLiveMap')}</Text>
            </Pressable>
          </View>
        </SectionCard>
        )}

        {/* ── Quick Access Links (Table 1.4) ── */}
        <View style={styles.grid}>
          {[
            { key: 'medical',  label: isTeacher ? (isFil ? 'Mga Profile\nng Bata' : 'Student\nProfiles') : t('quickMedical'),  icon: isTeacher ? 'people' : 'medkit',   color: '#005B96' },
            { key: 'history',  label: t('quickHistory'),  icon: 'time',     color: '#7C3AED' },
            { key: 'location', label: t('quickLocation'), icon: 'navigate', color: '#10B981' },
            { key: 'contacts', label: t('quickContacts'), icon: 'call',     color: '#E11D48' },
          ].map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label.replace('\n', ' ')}
              onPress={() => {
                if (item.key === 'contacts') {
                  setContactsOpen(true);
                } else {
                  go(item.key);
                }
              }}
              style={({ pressed }) => [
                styles.gridItem,
                isDark && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                pressed && { opacity: 0.82 },
              ]}
            >
              <View style={[styles.gridIcon, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={[styles.gridLabel, { color: colors.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Primary Action Zone: Prominent SOS Trigger in Thumb Zone (Table 1.4) ── */}
        <View style={styles.sosZone}>
          <Text style={[styles.sosZoneLabel, isDark && { color: colors.muted }]}>
            {isTeacher ? (isFil ? 'PINDUTAN NG ALERTO SA CSN CENTER' : 'CSN CENTER EMERGENCY TRIGGER') : t('primaryEmergencyTrigger')}
          </Text>

          <View style={styles.sosWrapper}>
            <Animated.View
              style={[
                styles.sosRing,
                { width: SOS_SIZE + 54, height: SOS_SIZE + 54, borderRadius: (SOS_SIZE + 54) / 2 },
                { transform: [{ scale: ring1 }], opacity: ringOpacity1 },
              ]}
            />
            <Animated.View
              style={[
                styles.sosRing,
                { width: SOS_SIZE + 32, height: SOS_SIZE + 32, borderRadius: (SOS_SIZE + 32) / 2 },
                { transform: [{ scale: ring2 }], opacity: ringOpacity2 },
              ]}
            />

            <Pressable
              onPress={() => setConfirmOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Trigger Emergency Alert"
              style={({ pressed }) => [
                styles.sosBtn,
                { width: SOS_SIZE, height: SOS_SIZE, borderRadius: SOS_SIZE / 2 },
                pressed && { backgroundColor: C.criticalDark },
              ]}
            >
              <Ionicons name="warning" size={40} color={C.white} />
              <Text style={styles.sosText}>
                {isTeacher ? (isFil ? 'MAGPADALA NG ALERTO\nSA CSN CENTER' : 'TRIGGER CSN\nCENTER ALERT') : t('triggerEmergencyAlert')}
              </Text>
            </Pressable>
          </View>

          {/* Prominent Thumb-Zone Action Button */}
          <Pressable
            onPress={() => setConfirmOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Trigger Emergency Alert button"
            style={({ pressed }) => [styles.thumbZoneSosBar, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="alert-circle" size={22} color={C.white} style={{ marginRight: 8 }} />
            <Text style={styles.thumbZoneSosText}>
              {isTeacher ? (isFil ? 'MAGPADALA NG ALERTO SA PASILIDAD' : 'TRIGGER CSN FACILITY ALERT') : t('triggerEmergencyAlertBtn')}
            </Text>
          </Pressable>

          <Text style={[styles.sosCaution, isDark && { color: colors.textSec }]}>
            {isTeacher
              ? (isFil
                ? 'Agarang aabisuhan ang Magulang/Tagapag-alaga ng bata AT ang CSN Command Center'
                : "Alerts both the student's Parent/Guardian AND CSN Command Center immediately")
              : t('sosCautionText')}
          </Text>
        </View>
      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <BottomTabBar current="dashboard" onPress={(k) => go(k)} unread={unread} isTeacher={isTeacher} />

      {/* ── SCREEN 5: Emergency Alert Trigger Flow Modal (Table 1.5) ── */}
      <Modal visible={confirmOpen} transparent animationType="slide" onRequestClose={closeConfirm}>
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalSheet, isDark && { backgroundColor: colors.card }]}>
              <View style={styles.modalHandle} />

              <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
                <View style={styles.row}>
                  <View style={[styles.modalIconCircle, { width: 44, height: 44, borderRadius: 22, marginBottom: 0, marginRight: 10 }]}>
                    <Ionicons name="warning" size={24} color={C.critical} />
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 2 }, isDark && { color: colors.text }]}>
                      {isTeacher ? (isFil ? 'Alerto sa CSN Center Emergency' : 'CSN Center Emergency Alert') : t('dispatchEmergencyAlert')}
                    </Text>
                    <Text style={{ color: colors.textSec, fontSize: 13 }}>
                      {isTeacher
                        ? (isFil ? 'Aabisuhan ang Tagapag-alaga ng Bata at CSN Admin' : 'Notifies Student Guardian & CSN Admin')
                        : t('dispatchSub')}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={closeConfirm} style={styles.backBtn} accessibilityLabel="Close modal">
                  <Ionicons name="close" size={24} color={C.muted} />
                </Pressable>
              </View>

              {/* Teacher-Only: Student & CSN Facility Room Selection */}
              {isTeacher && (
                <View style={{ marginTop: 4, marginBottom: 8 }}>
                  <View
                    style={{
                      backgroundColor: '#F0FDFA',
                      borderColor: '#99F6E4',
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="notifications" size={18} color="#0F766E" />
                    <Text style={{ flex: 1, fontSize: 12, color: '#115E59', fontWeight: '600' }}>
                      Triggering this alert immediately notifies the student&apos;s Parent/Guardian AND the CSN Center Admin.
                    </Text>
                  </View>

                  {/* 1. Choose Student Involved */}
                  <Text style={[styles.label, { marginBottom: 6 }, isDark && { color: colors.text }]}>
                    {isFil ? 'Piliin ang Batang Sangkot (Pangalan ng Bata) *' : 'Select Student Involved (Pangalan ng Bata) *'}
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      { marginBottom: 8, minHeight: 40 },
                      isDark && { backgroundColor: colors.bg, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="search-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
                    <TextInput
                      value={studentSearch}
                      onChangeText={setStudentSearch}
                      placeholder={isFil ? 'Salain ang pangalan ng estudyante...' : 'Filter student name...'}
                      placeholderTextColor={colors.muted}
                      style={[styles.inputInner, { fontSize: 13, color: colors.text }]}
                    />
                  </View>
                  <ScrollView
                    style={{ maxHeight: 150, marginBottom: 12 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {filteredStudents.map((student) => {
                      const active = selectedStudent && String(selectedStudent.id) === String(student.id);
                      return (
                        <Pressable
                          key={student.id}
                          onPress={() => {
                            setSelectedChildId(student.id);
                            setTeacherValidationErr('');
                          }}
                          style={[
                            styles.dropdownModalItem,
                            { padding: 10, marginBottom: 6 },
                            isDark && { backgroundColor: colors.bg, borderColor: colors.border },
                            active && { backgroundColor: isDark ? '#0C4A6E' : C.brandLight, borderColor: colors.brand },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: active ? '800' : '700', color: active ? colors.brand : colors.text }}>
                              {student.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textSec }}>
                              {student.disability || student.condition || 'Special Child'}
                              {student.guardian_name ? ` • ${isFil ? 'Tagapag-alaga' : 'Guardian'}: ${student.guardian_name}` : ''}
                            </Text>
                          </View>
                          <Ionicons
                            name={active ? 'checkmark-circle' : 'radio-button-off'}
                            size={20}
                            color={active ? colors.brand : colors.muted}
                          />
                        </Pressable>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 8 }}>
                        {isFil ? 'Walang nakatalang estudyanteng tugma sa iyong hinahanap.' : 'No enrolled students match your search.'}
                      </Text>
                    )}
                  </ScrollView>

                  {/* 2. Choose CSN Center Facility / Room */}
                  <Text style={[styles.label, { marginBottom: 6 }, isDark && { color: colors.text }]}>
                    {isFil ? 'Pasilidad / Silid sa CSN Center *' : 'CSN Center Facility / Room *'}
                  </Text>
                  <View style={styles.chipWrap}>
                    {CSN_FACILITY_ROOMS.map((room) => {
                      const active = facilityRoom === room;
                      return (
                        <Pressable
                          key={room}
                          onPress={() => {
                            setFacilityRoom(room);
                            setTeacherValidationErr('');
                          }}
                          style={[
                            styles.chip,
                            active
                              ? { backgroundColor: C.brand, borderColor: C.brand }
                              : (isDark && { backgroundColor: colors.bg, borderColor: colors.border }),
                          ]}
                        >
                          <Ionicons
                            name="business-outline"
                            size={14}
                            color={active ? C.white : colors.textSec}
                            style={{ marginRight: 5 }}
                          />
                          <Text style={[styles.chipText, { fontSize: 12 }, active ? { color: C.white } : (isDark && { color: colors.text })]}>
                            {room}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 1. Alert Type Selector (Table 1.5) */}
              <Text style={[styles.label, { marginTop: 8, marginBottom: 8 }, isDark && { color: colors.text }]}>{t('selectAlertType')}</Text>
              <View style={styles.chipWrap}>
                {emergencyTypes.map((tItem) => {
                  const active = type === tItem.key;
                  return (
                    <Pressable
                      key={tItem.key}
                      onPress={() => setType(tItem.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.chip,
                        active
                          ? { backgroundColor: C.critical, borderColor: C.critical }
                          : (isDark && { backgroundColor: colors.bg, borderColor: colors.border }),
                      ]}
                    >
                      <Ionicons
                        name={tItem.icon}
                        size={16}
                        color={active ? C.white : colors.textSec}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.chipText, active ? { color: C.white } : (isDark && { color: colors.text })]}>{tItem.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 2. Urgency Level Selector (Table 1.5) */}
              <Text style={[styles.label, { marginBottom: 8 }, isDark && { color: colors.text }]}>{t('urgencyLevel')}</Text>
              <View style={[styles.row, { gap: 10, marginBottom: 14 }]}>
                <Pressable
                  onPress={() => setUrgency('high')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: urgency === 'high' }}
                  style={[
                    styles.urgencyOption,
                    isDark && { backgroundColor: colors.bg, borderColor: colors.border },
                    urgency === 'high' && styles.urgencyOptionHighActive,
                  ]}
                >
                  <View style={styles.row}>
                    <Ionicons
                      name="flash"
                      size={18}
                      color={urgency === 'high' ? C.white : C.critical}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.urgencyTitle, urgency === 'high' ? { color: C.white } : { color: colors.text }]}>
                      {t('highUrgency')}
                    </Text>
                  </View>
                  <Text style={[styles.urgencySub, urgency === 'high' ? { color: 'rgba(255,255,255,0.9)' } : { color: colors.textSec }]}>
                    {t('highUrgencySub')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setUrgency('low')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: urgency === 'low' }}
                  style={[
                    styles.urgencyOption,
                    isDark && { backgroundColor: colors.bg, borderColor: colors.border },
                    urgency === 'low' && styles.urgencyOptionLowActive,
                  ]}
                >
                  <View style={styles.row}>
                    <Ionicons
                      name="alert-circle"
                      size={18}
                      color={urgency === 'low' ? C.white : C.amberDark}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.urgencyTitle, urgency === 'low' ? { color: C.white } : { color: colors.text }]}>
                      {t('lowUrgency')}
                    </Text>
                  </View>
                  <Text style={[styles.urgencySub, urgency === 'low' ? { color: 'rgba(255,255,255,0.9)' } : { color: colors.textSec }]}>
                    {t('lowUrgencySub')}
                  </Text>
                </Pressable>
              </View>

              {/* 3. Optional Message Field (Table 1.5) */}
              <Field
                label={t('optionalMessage')}
                value={message}
                onChangeText={setMessage}
                placeholder={isFil ? 'hal. Nagkakaroon ng sensory meltdown ang bata malapit sa Puregold Sucat...' : 'e.g. Child having sensory meltdown near Puregold Sucat, needs quiet transport...'}
                multiline
                leftIcon="chatbox-ellipses-outline"
              />

              {/* 4. Location Toggle (Table 1.5) */}
              <Pressable
                onPress={() => setShareLocation((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: shareLocation }}
                style={[styles.locationToggleRow, isDark && { backgroundColor: colors.bg, borderColor: colors.border }]}
              >
                <View style={[styles.row, { flex: 1, marginRight: 12 }]}>
                  <View style={[styles.gridIcon, { width: 40, height: 40, borderRadius: 20, marginBottom: 0, marginRight: 10, backgroundColor: shareLocation ? C.successLight : (isDark ? colors.border : C.border) }]}>
                    <Ionicons name={shareLocation ? 'location' : 'location-outline'} size={20} color={shareLocation ? C.successDark : C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                      {t('shareGpsLabel')}
                    </Text>
                    <Text style={{ color: colors.textSec, fontSize: 12, marginTop: 2 }}>
                      {shareLocation
                        ? t('shareGpsSubOn')
                        : t('shareGpsSubOff')}
                    </Text>
                  </View>
                </View>
                <View style={[styles.toggleTrack, shareLocation && styles.toggleTrackActive]}>
                  <View style={[styles.toggleThumb, shareLocation && styles.toggleThumbActive]} />
                </View>
              </Pressable>

              {/* Error banner */}
              {(!!triggerError || !!teacherValidationErr) && (
                <View style={[styles.errorBanner, { marginTop: 12 }]} accessibilityLiveRegion="assertive">
                  <Ionicons name="alert-circle" size={20} color={C.critical} />
                  <Text style={styles.errorBannerText}>
                    {teacherValidationErr || (isFil ? `${triggerError} Kung patuloy na pumalya, tumawag agad sa ${EMERGENCY_NUMBER}.` : `${triggerError} If this keeps failing, call ${EMERGENCY_NUMBER} now.`)}
                  </Text>
                </View>
              )}

              {/* 5. Trigger Actions: 1s Hold-to-Confirm OR Send Alert with Confirmation Dialog */}
              <View style={{ marginTop: 14 }}>
                <HoldToConfirm
                  busy={triggering}
                  label={t('holdToSend')}
                  onConfirm={handleDispatch}
                />

                <PrimaryButton
                  title={t('sendAlertConfirm')}
                  tone="outline"
                  icon="paper-plane-outline"
                  onPress={() => {
                    if (validateTeacherAlert()) setFinalConfirmOpen(true);
                  }}
                  disabled={triggering}
                  style={{ marginTop: 10 }}
                />

                <PrimaryButton
                  title={t('cancelBtn')}
                  tone="ghost"
                  onPress={closeConfirm}
                  style={{ marginTop: 6 }}
                  disabled={triggering}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Final Confirmation Dialog for "Send Alert" tap */}
      <Modal visible={finalConfirmOpen} transparent animationType="fade" onRequestClose={() => setFinalConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, isDark && { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalIconCircle}>
              <Ionicons name="paper-plane" size={30} color={C.critical} />
            </View>
            <Text style={[styles.modalTitle, isDark && { color: colors.text }]}>{t('confirmDispatchTitle')}</Text>
            <Text style={[styles.modalBody, isDark && { color: colors.textSec }]}>
              {isFil ? 'Nagpapadala ka ng ' : 'You are sending a '}
              <Text style={{ fontWeight: '800', color: C.critical }}>
                {isFil
                  ? (urgency === 'high' ? 'MATAAS NA ANTAS NG' : 'MABABANG ANTAS NG')
                  : `${urgency.toUpperCase()} URGENCY`}
              </Text>{' '}
              {isFil ? 'alerto ' : 'alert '}
              ({(emergencyTypes.find((item) => item.key === type) || {}).label})
              {isTeacher && selectedStudent
                ? (isFil
                  ? ` para kay ${selectedStudent.name} sa CSN Center (${facilityRoom}) — aabisuhan nito ang kanilang Magulang/Tagapag-alaga at CSN Admin`
                  : ` for ${selectedStudent.name} at CSN Center (${facilityRoom}) — this will notify their Parent/Guardian and CSN Admin`)
                : (isFil
                  ? ` sa Parañaque CSN Center${urgency === 'high' ? ' at DRRMO Ambulance Dispatch' : ''}`
                  : ` to Parañaque CSN Center${urgency === 'high' ? ' and DRRMO Ambulance Dispatch' : ''}`)}
              .
            </Text>
            <PrimaryButton
              title={t('confirmDispatchBtn')}
              tone="critical"
              icon="warning"
              loading={triggering}
              onPress={handleDispatch}
            />
            <PrimaryButton
              title={t('goBackBtn')}
              tone="ghost"
              onPress={() => setFinalConfirmOpen(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>

      {/* Quick Emergency Contacts Modal (from Dashboard Quick Access) */}
      <Modal visible={contactsOpen} transparent animationType="slide" onRequestClose={() => setContactsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, isDark && { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isDark && { color: colors.text }]}>{t('emergencyContactsTitle')}</Text>
            <Text style={[styles.modalBody, isDark && { color: colors.textSec }]}>{t('emergencyContactsSub')}</Text>

            {[
              {
                name: isFil ? 'Pambansang Emergency Hotline' : 'National Emergency Hotline',
                role: isFil ? 'Pulisya, Bumbero, Serbisyong Medikal' : 'Police, Fire, Medical Dispatch',
                phone: EMERGENCY_NUMBER,
                color: C.critical,
                icon: 'call',
              },
              {
                name: isFil ? 'Parañaque DRRMO / Rescue' : 'Parañaque DRRMO / Rescue',
                role: isFil ? '24/7 Ambulansya at Pagtugon sa Sakuna' : '24/7 City Ambulance & Disaster Response',
                phone: '(02) 8820-PQUE',
                color: C.amberDark,
                icon: 'medkit',
              },
              {
                name: 'Parañaque CSN Center',
                role: isFil ? 'Desk ng Suporta ng CSN Center' : 'CSN Center Support Desk',
                phone: CSN_HOTLINE,
                color: C.brand,
                icon: 'shield-checkmark',
              },
              ...(child && child.emergency_contact_phone
                ? [
                    {
                      name: child.emergency_contact_name || (isFil ? 'Pamalit na Kontak sa Pamilya' : 'Backup Family Contact'),
                      role: isFil ? 'Nakatalang Pangalawang Emergency Contact' : 'Registered Secondary Emergency Contact',
                      phone: child.emergency_contact_phone,
                      color: C.successDark,
                      icon: 'people',
                    },
                  ]
                : []),
            ].map((c) => (
              <Pressable
                key={c.name}
                onPress={() => callEmergencyNumber(c.phone)}
                accessibilityRole="button"
                style={[styles.contactModalRow, isDark && { backgroundColor: colors.bg, borderColor: colors.border }]}
              >
                <View style={[styles.supportIconCircle, { backgroundColor: c.color + '18' }]}>
                  <Ionicons name={c.icon} size={20} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{c.name}</Text>
                  <Text style={{ color: colors.textSec, fontSize: 12 }}>{c.role} • {c.phone}</Text>
                </View>
                <Ionicons name="call-outline" size={20} color={c.color} />
              </Pressable>
            ))}

            <PrimaryButton
              title={t('editContactsBtn')}
              tone="outline"
              icon="create-outline"
              onPress={() => {
                setContactsOpen(false);
                go('medical');
              }}
              style={{ marginTop: 12 }}
            />
            <PrimaryButton
              title={t('closeBtn')}
              tone="ghost"
              onPress={() => setContactsOpen(false)}
              style={{ marginTop: 6 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
