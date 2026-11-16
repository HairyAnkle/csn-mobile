import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionCard } from '../components/SectionCard';
import { COMMUNICATION_TAGS, DISABILITY_CHIPS } from '../constants/data';
import { api } from '../services/api';
import { C } from '../theme/colors';
import { styles } from '../theme/styles';
import { callEmergencyNumber } from '../utils/device';

/* ============================================================================
 * SCREEN 7 — MEDICAL & PERSONAL INFORMATION (Table 1.7)
 * Also renders CSN Student (Special Child) Profiles Directory for Teacher users
 * ========================================================================== */

export function MedicalProfileScreen({
  guardian,
  child,
  childrenList = [],
  token,
  go,
  onSaved,
  onTriggerForChild,
  showToast,
  unread,
}) {
  const { isDark, colors, t, lang, isTeacher: contextIsTeacher } = useApp();
  const isTeacher = Boolean((guardian && guardian.role === 'teacher') || contextIsTeacher);

  const [students, setStudents]               = useState(childrenList);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentQuery, setStudentQuery]       = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    setStudents(childrenList);
  }, [childrenList]);

  const loadStudents = useCallback(async () => {
    if (!isTeacher || !token) return;
    setLoadingStudents(true);
    try {
      const data = await api('/children', { token });
      if (data && Array.isArray(data.children)) {
        setStudents(data.children);
      }
    } catch {
      // Keep cached list
    } finally {
      setLoadingStudents(false);
    }
  }, [isTeacher, token]);

  useEffect(() => {
    if (isTeacher) {
      loadStudents();
    }
  }, [isTeacher, loadStudents]);
  const getInitialForm = (c) => ({
    name: c?.name || '',
    age: c && c.age != null ? String(c.age) : '',
    disability: c?.disability || '',
    allergies: c?.allergies || '',
    medications: c?.medications || '',
    communication_notes: c?.communication_notes || '',
    guardian_phone: c?.guardian_phone || '',
    emergency_contact_name: c?.emergency_contact_name || '',
    emergency_contact_phone: c?.emergency_contact_phone || '',
  });

  const [form, setForm]               = useState(() => getInitialForm(child));
  const [errors, setErrors]           = useState({});
  const [saving, setSaving]           = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);

  useEffect(() => {
    if (child) {
      setForm(getInitialForm(child));
    }
  }, [child]);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Enter your child's full name.";
    if (!form.age?.trim() || isNaN(Number(form.age)) || Number(form.age) < 0 || Number(form.age) > 25)
      e.age = 'Enter a valid age (0–25).';
    if (!form.disability?.trim()) e.disability = 'Select or enter a disability classification.';
    if (!form.guardian_phone?.trim()) e.guardian_phone = 'Enter your primary guardian phone number.';
    if (!form.emergency_contact_phone?.trim()) e.emergency_contact_phone = 'Enter a backup emergency contact number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await api('/child', { method: 'PUT', token, body: { ...form, age: Number(form.age) } });
      onSaved(data.child || form);
      showToast('Changes saved successfully.');
    } catch (err) {
      if (err.errors) {
        const mapped = {};
        Object.keys(err.errors).forEach((k) => {
          mapped[k] = Array.isArray(err.errors[k]) ? err.errors[k][0] : String(err.errors[k]);
        });
        setErrors(mapped);
      }
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDisabilitySelect = (item) => {
    setForm((f) => ({ ...f, disability: item }));
    if (errors.disability) setErrors((e) => ({ ...e, disability: undefined }));
    setPickerOpen(false);
  };

  const appendCommTag = (tag) => {
    setForm((f) => {
      const current = f.communication_notes ? f.communication_notes.trim() : '';
      if (current.toLowerCase().includes(tag.toLowerCase())) return f;
      const next = current ? `${current}; ${tag}` : tag;
      return { ...f, communication_notes: next };
    });
  };

  if (isTeacher) {
    const q = studentQuery.trim().toLowerCase();
    const filteredStudents = students.filter((s) => {
      if (!q) return true;
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.disability || s.condition || '').toLowerCase().includes(q) ||
        (s.allergies || '').toLowerCase().includes(q) ||
        (s.guardian_name || '').toLowerCase().includes(q)
      );
    });

    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={C.brand} />

        <View style={[styles.innerHeader, styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.innerHeaderTitle} accessibilityRole="header">
            {t('teacherStudentsTitle')}
          </Text>
          <Pressable onPress={loadStudents} style={styles.headerActionBtn} accessibilityLabel="Refresh student list">
            <Ionicons name="refresh" size={16} color={C.white} style={{ marginRight: 4 }} />
            <Text style={{ color: C.white, fontSize: 12, fontWeight: '700' }}>{t('refreshBtn')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.medScroll} showsVerticalScrollIndicator={false}>
          <SectionCard style={{ marginBottom: 14 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>
              {t('teacherStudentsCountLabel')} ({students.length})
            </Text>
            <Text style={{ color: colors.textSec, fontSize: 12, marginBottom: 10 }}>
              {t('teacherStudentsHint')}
            </Text>
            <View
              style={[
                styles.inputWrap,
                { minHeight: 44 },
                isDark && { backgroundColor: colors.bg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                value={studentQuery}
                onChangeText={setStudentQuery}
                placeholder={lang === 'Filipino' ? 'Hanapin ang pangalan, kondisyon, o magulang...' : 'Search student name, condition, or guardian...'}
                placeholderTextColor={colors.muted}
                style={[styles.inputInner, { fontSize: 14, color: colors.text }]}
              />
            </View>
          </SectionCard>

          {loadingStudents && <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />}

          {!loadingStudents && filteredStudents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={42} color={colors.muted} />
              <Text style={[styles.emptyText, isDark && { color: colors.textSec }]}>
                No Special Child profiles found.
              </Text>
            </View>
          ) : (
            filteredStudents.map((student) => {
              const initials = (student.name || 'SC')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <Pressable
                  key={student.id}
                  onPress={() => setSelectedStudent(student)}
                  style={[
                    styles.facilityCard,
                    isDark && { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.row, { alignItems: 'flex-start' }]}>
                    <View
                      style={[
                        styles.childAvatar,
                        { backgroundColor: C.brand, borderColor: C.brandLight, marginRight: 12 },
                      ]}
                    >
                      <Text style={styles.childAvatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 }}>
                          {student.name}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                          {student.age != null ? `${student.age} yrs` : ''}
                        </Text>
                      </View>
                      <View style={[styles.disabilityChip, { marginBottom: 6 }, isDark && { backgroundColor: colors.brandLight }]}>
                        <Text style={[styles.disabilityChipText, isDark && { color: colors.brand }]}>
                          {student.disability || student.condition || 'Special Needs'}
                        </Text>
                      </View>
                      {!!student.allergies && student.allergies !== 'None reported' && (
                        <Text style={{ color: C.criticalDark, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
                          Allergies: {student.allergies}
                        </Text>
                      )}
                      <Text style={{ color: colors.textSec, fontSize: 12 }} numberOfLines={2}>
                        {student.communication_notes || 'Tap to view full medical, medication & guardian contact details'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Student Detail Modal */}
        <Modal
          visible={!!selectedStudent}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedStudent(null)}
        >
          <View style={styles.modalBackdrop}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
              <View style={[styles.modalSheet, isDark && { backgroundColor: colors.card }]}>
                <View style={styles.modalHandle} />
                {selectedStudent && (
                  <>
                    <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 2 }, isDark && { color: colors.text }]}>
                          {selectedStudent.name}
                        </Text>
                        <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '700' }}>
                          {selectedStudent.disability || selectedStudent.condition}
                          {selectedStudent.age != null ? ` • ${selectedStudent.age} yrs old` : ''}
                        </Text>
                      </View>
                      <Pressable onPress={() => setSelectedStudent(null)} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={C.muted} />
                      </Pressable>
                    </View>

                    <View
                      style={{
                        backgroundColor: isDark ? colors.bg : C.bg,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 14,
                        gap: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View>
                        <Text style={styles.histDetailLabel}>{lang === 'Filipino' ? 'MGA ALERDYE' : 'ALLERGIES'}</Text>
                        <Text style={[styles.histDetailValue, isDark && { color: colors.text }]}>
                          {selectedStudent.allergies || (lang === 'Filipino' ? 'Walang naiulat' : 'None reported')}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.histDetailLabel}>{lang === 'Filipino' ? 'MGA GAMOT' : 'MEDICATIONS'}</Text>
                        <Text style={[styles.histDetailValue, isDark && { color: colors.text }]}>
                          {selectedStudent.medications || (lang === 'Filipino' ? 'Walang naitala' : 'None recorded')}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.histDetailLabel}>{lang === 'Filipino' ? 'TALA SA KOMUNIKASYON AT PAGPAPAKALMA' : 'COMMUNICATION & CALMING NOTES'}</Text>
                        <Text style={[styles.histDetailValue, isDark && { color: colors.text }]}>
                          {selectedStudent.communication_notes || (lang === 'Filipino' ? 'Walang espesipikong tala.' : 'No specific communication notes recorded.')}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.histDetailLabel}>{lang === 'Filipino' ? 'MAGULANG / TAGAPAG-ALAGA AT CONTACT' : 'PARENT / GUARDIAN & EMERGENCY CONTACT'}</Text>
                        <Text style={[styles.histDetailValue, isDark && { color: colors.text }]}>
                          {selectedStudent.guardian_name || (lang === 'Filipino' ? 'Tagapag-alaga' : 'Guardian')} • {selectedStudent.guardian_phone || selectedStudent.emergency_contact_phone || (lang === 'Filipino' ? 'Walang numero' : 'No phone')}
                        </Text>
                        {!!selectedStudent.emergency_contact_phone && (
                          <Text style={{ color: colors.textSec, fontSize: 12, marginTop: 2 }}>
                            Backup: {selectedStudent.emergency_contact_name || 'Contact'} ({selectedStudent.emergency_contact_phone})
                          </Text>
                        )}
                      </View>
                    </View>

                    {!!(selectedStudent.guardian_phone || selectedStudent.emergency_contact_phone) && (
                      <PrimaryButton
                        title={`${lang === 'Filipino' ? 'Tawagan ang Magulang' : 'Call Guardian'} (${selectedStudent.guardian_phone || selectedStudent.emergency_contact_phone})`}
                        tone="outline"
                        icon="call-outline"
                        onPress={() => callEmergencyNumber(selectedStudent.guardian_phone || selectedStudent.emergency_contact_phone)}
                        style={{ marginBottom: 10 }}
                      />
                    )}

                    {onTriggerForChild && (
                      <PrimaryButton
                        title={lang === 'Filipino' ? 'Magpadala ng CSN Alert para sa Batang Ito' : 'Trigger CSN Alert for This Student'}
                        tone="critical"
                        icon="warning"
                        onPress={() => {
                          const target = selectedStudent;
                          setSelectedStudent(null);
                          onTriggerForChild(target);
                        }}
                      />
                    )}

                    <PrimaryButton
                      title={t('closeBtn')}
                      tone="ghost"
                      onPress={() => setSelectedStudent(null)}
                      style={{ marginTop: 8 }}
                    />
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>

        <BottomTabBar current="medical" onPress={(k) => go(k)} unread={unread} isTeacher />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.brand} />

      {/* Header bar */}
      <View style={styles.innerHeader}>
        <Text style={styles.innerHeaderTitle} accessibilityRole="header">{t('medicalTitle')}</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.medScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Section 1: Child Profile Fields (Table 1.7) ── */}
          <Text style={[styles.sectionHeading, isDark && { color: colors.brand }]}>{t('childClassification')}</Text>
          <SectionCard>
            <Field
              label={t('childFullNameLabel')}
              value={form.name}
              onChangeText={set('name')}
              error={errors.name}
              autoCapitalize="words"
              leftIcon="person-outline"
              placeholder="e.g. Mateo Garcia"
            />
            <Field
              label={t('childAgeLabel')}
              value={form.age}
              onChangeText={set('age')}
              error={errors.age}
              keyboardType="number-pad"
              leftIcon="calendar-outline"
              placeholder="e.g. 8"
            />

            {/* Disability Classification Dropdown Trigger (Table 1.7) */}
            <Text style={[styles.label, isDark && { color: colors.text }]}>{t('disabilityDropdownLabel')}</Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open Disability Classification dropdown"
              style={[
                styles.dropdownSelector,
                isDark && { backgroundColor: colors.card, borderColor: colors.border },
                !!errors.disability && { borderColor: C.critical },
              ]}
            >
              <Ionicons name="accessibility-outline" size={20} color={colors.brand} style={{ marginRight: 10 }} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: form.disability ? colors.text : colors.muted,
                  fontWeight: form.disability ? '700' : '400',
                }}
              >
                {form.disability || (lang === 'Filipino' ? 'Pumili ng Klasipikasyon…' : 'Select Disability Classification…')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={C.muted} />
            </Pressable>

            {/* Quick-select classification chips */}
            <View style={[styles.chipWrap, { marginTop: 10 }]}>
              {DISABILITY_CHIPS.map((chip) => {
                const active = form.disability === chip;
                return (
                  <Pressable
                    key={chip}
                    onPress={() => handleDisabilitySelect(chip)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    style={[
                      styles.chip,
                      isDark && { backgroundColor: colors.card, borderColor: colors.border },
                      active && { backgroundColor: colors.brand, borderColor: colors.brand },
                    ]}
                  >
                    <Text style={[styles.chipText, isDark && { color: colors.text }, active && { color: C.white }]}>{chip}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label={t('customDiagnosisLabel')}
              value={form.disability}
              onChangeText={set('disability')}
              error={errors.disability}
              placeholder={lang === 'Filipino' ? 'O i-type ang tiyak na kondisyon...' : 'Or type specific condition...'}
              style={{ marginTop: 4 }}
            />
          </SectionCard>

          {/* ── Section 2: Medical Notes & Communication Needs (Table 1.7) ── */}
          <Text style={[styles.sectionHeading, isDark && { color: colors.brand }]}>{t('medicalSensory')}</Text>
          <SectionCard>
            <Field
              label={t('allergiesLabel')}
              value={form.allergies}
              onChangeText={set('allergies')}
              multiline
              placeholder={lang === 'Filipino' ? "Ilista ang mga alerdye sa pagkain/gamot, o ilagay ang 'Wala'" : "List food/drug allergies, or write 'None'"}
              leftIcon="alert-circle-outline"
            />
            <Field
              label={t('medicationLabel')}
              value={form.medications}
              onChangeText={set('medications')}
              multiline
              placeholder={lang === 'Filipino' ? "Pangalan ng gamot, dosis at iskedyul, o 'Wala'" : "Medication name, dosage & schedule, or 'None'"}
              leftIcon="medkit-outline"
            />

            <Text style={[styles.label, isDark && { color: colors.text }]}>{t('quickCommTagsLabel')}</Text>
            <View style={[styles.chipWrap, { marginBottom: 10 }]}>
              {COMMUNICATION_TAGS.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => appendCommTag(tag)}
                  style={[styles.commTagChip, isDark && { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Ionicons name="add-circle-outline" size={14} color={colors.brand} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}>{tag}</Text>
                </Pressable>
              ))}
            </View>

            <Field
              label={t('notesLabel')}
              value={form.communication_notes}
              onChangeText={set('communication_notes')}
              multiline
              placeholder="e.g. Non-verbal, sound sensitivity, uses visual schedule cards"
              leftIcon="chatbubble-ellipses-outline"
            />
          </SectionCard>

          {/* ── Section 3: Emergency Contacts (Table 1.7) ── */}
          <Text style={[styles.sectionHeading, isDark && { color: colors.brand }]}>{t('emergencyContact')}</Text>
          <SectionCard>
            <Field
              label={t('primaryGuardianPhoneLabel')}
              value={form.guardian_phone}
              onChangeText={set('guardian_phone')}
              error={errors.guardian_phone}
              keyboardType="phone-pad"
              leftIcon="call-outline"
              placeholder="+63 9XX XXX XXXX"
            />
            <Field
              label={t('backupContactNameLabel')}
              value={form.emergency_contact_name}
              onChangeText={set('emergency_contact_name')}
              autoCapitalize="words"
              leftIcon="person-add-outline"
              placeholder={lang === 'Filipino' ? 'Buong pangalan ng pangalawang contact' : 'Full name of secondary contact'}
            />
            <Field
              label={t('backupContactPhoneLabel')}
              value={form.emergency_contact_phone}
              onChangeText={set('emergency_contact_phone')}
              error={errors.emergency_contact_phone}
              keyboardType="phone-pad"
              leftIcon="call-outline"
              placeholder="+63 9XX XXX XXXX"
            />
          </SectionCard>

          {/* Action Control: "Save Changes" button with validation & confirmation toast (Table 1.7) */}
          <PrimaryButton
            title={t('saveProfileBtn')}
            tone="brand"
            icon="save-outline"
            onPress={save}
            loading={saving}
            style={{ marginTop: 8 }}
          />
          <View style={{ height: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Disability Classification Dropdown Modal */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, isDark && { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isDark && { color: colors.text }]}>{t('selectDisabilityTitle')}</Text>
            <Text style={[styles.modalBody, isDark && { color: colors.textSec }]}>
              {t('selectDisabilitySub')}
            </Text>
            {DISABILITY_CHIPS.map((item) => {
              const selected = form.disability === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => handleDisabilitySelect(item)}
                  style={[
                    styles.dropdownModalItem,
                    isDark && { backgroundColor: colors.bg, borderColor: colors.border },
                    selected && { backgroundColor: isDark ? '#0C4A6E' : C.brandLight, borderColor: colors.brand },
                  ]}
                >
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: selected ? '800' : '600', color: selected ? colors.brand : colors.text }}>
                    {item}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
                </Pressable>
              );
            })}
            <PrimaryButton
              title={t('closeBtn')}
              tone="ghost"
              onPress={() => setPickerOpen(false)}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>

      <BottomTabBar current="medical" onPress={(k) => go(k)} unread={unread} />
    </SafeAreaView>
  );
}
