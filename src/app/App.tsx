import { FONT } from '../theme/fonts';
import { GlyphsScreen } from '../ui/screens/GlyphsScreen';
import { HomeScreen } from '../ui/screens/HomeScreen';
import { Screen } from '../ui/tui/Screen';
import { route } from './router';

export function App() {
  return (
    <Screen font={FONT}>
      {(info) => (route.value === 'glyphs' ? <GlyphsScreen screen={info} /> : <HomeScreen screen={info} />)}
    </Screen>
  );
}
