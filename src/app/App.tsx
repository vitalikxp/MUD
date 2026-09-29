import { FONTS } from '../theme/fonts';
import { GlyphsScreen } from '../ui/screens/GlyphsScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { HomeScreen } from '../ui/screens/HomeScreen';
import { Screen } from '../ui/tui/Screen';
import { route } from './router';
import { fontId } from './settings';

export function App() {
  const font = FONTS[fontId.value];
  return (
    <Screen font={font}>
      {(info) =>
        route.value === 'glyphs' ? <GlyphsScreen screen={info} /> : route.value === 'settings' ? <SettingsScreen screen={info} /> : <HomeScreen screen={info} />}
    </Screen>
  );
}
