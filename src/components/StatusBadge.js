import { Text, View } from 'react-native';

import { useApp } from '../context/AppContext';
import { getStatusStyle } from '../constants/data';
import { styles } from '../theme/styles';

export function StatusBadge({ status }) {
  const { lang } = useApp();
  const s = getStatusStyle(status, lang);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}
