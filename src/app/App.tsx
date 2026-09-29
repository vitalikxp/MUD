import { FONT } from '../theme/fonts';
import { GameScreen } from '../ui/screens/GameScreen';
import { GlyphsScreen } from '../ui/screens/GlyphsScreen';
import { HomeScreen } from '../ui/screens/HomeScreen';
import { SettingsDialog } from '../ui/screens/SettingsDialog';
import { TitleScreen } from '../ui/screens/TitleScreen';
import { Screen } from '../ui/tui/Screen';
import * as llm from './llm';
import { route } from './router';

export function App() {
  return (
    <Screen font={FONT}>
      {(info) => {
        // Первый запуск без настроек LLM: ничего, кроме окна настроек. Закрыть его нельзя, пока не выбрано «Начать игру».
        if (llm.setupPending.value) {
          return (
            <>
              <SettingsDialog gate onClose={() => {}} onStart={() => { llm.setupPending.value = false; }} />
              <div class="tui-sr-only" role="status" />
            </>
          );
        }
        const r = route.value;
        switch (r.page) {
          case 'glyphs': return <GlyphsScreen screen={info} />;
          case 'chat': return <HomeScreen screen={info} />;
          case 'game': return <GameScreen screen={info} id={r.id} />;
          case 'title': return <TitleScreen screen={info} />;
        }
      }}
    </Screen>
  );
}
