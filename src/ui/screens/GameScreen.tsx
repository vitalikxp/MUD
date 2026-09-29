import { useEffect, useState } from 'preact/hooks';
import { closeSession, openSession, session } from '../../app/campaigns';
import { navigate } from '../../app/router';
import { t } from '../../i18n';
import { Panel } from '../tui/Panel';
import { cellBox, type ScreenInfo } from '../tui/Screen';
import { TextView } from '../tui/TextView';
import { CreationScreen } from './CreationScreen';
import { HomeScreen } from './HomeScreen';

type Load = 'loading' | 'ready' | 'missing';

/** Кампания по адресу /game/<id>: загрузка → создание героя (если его ещё нет) → игра. */
export function GameScreen({ screen, id }: { screen: ScreenInfo; id: string }) {
  const [load, setLoad] = useState<Load>('loading');

  useEffect(() => {
    let alive = true;
    setLoad('loading');
    openSession(id).then(
      (found) => { if (alive) setLoad(found ? 'ready' : 'missing'); },
      () => { if (alive) setLoad('missing'); },
    );
    return () => {
      alive = false;
      closeSession();
    };
  }, [id]);

  const current = session.value;
  if (load === 'ready' && current?.meta.id === id) {
    return current.meta.phase === 'creation' ? <CreationScreen screen={screen} /> : <HomeScreen screen={screen} game />;
  }

  const missing = load === 'missing';
  return (
    <Panel x={0} y={0} w={screen.cols} h={Math.min(screen.rows, 5)} title={t('app.name')} active>
      <div style={cellBox(0, 1, screen.cols - 2, 2)}>
        <TextView lines={[[{ text: t(missing ? 'game.missing' : 'game.loading'), fg: missing ? 'warning' : 'fgDim' }], missing ? [{ text: '' }] : [{ text: '' }]]} width={screen.cols - 2} height={2} anchor="top" live />
      </div>
      {missing ? (
        <button type="button" class="tui-fkey" style={cellBox(0, 2, screen.cols - 2, 1)} onClick={() => navigate({ page: 'title' })}>
          {`[ ${t('fkeys.campaigns')} ]`}
        </button>
      ) : null}
    </Panel>
  );
}
