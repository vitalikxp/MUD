import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { computeMetrics, loadFont, measureCharWidth, MIN_COLS, type CellMetrics, type FontDef } from '../../theme/fonts';
import { cssVar } from '../../theme/palettes';
import { MouseCursor } from './MouseCursor';

export interface ScreenInfo extends CellMetrics {
  mobile: boolean;
}

const ScreenContext = createContext<ScreenInfo | null>(null);

export function useScreen(): ScreenInfo {
  const info = useContext(ScreenContext);
  if (!info) throw new Error('useScreen: компонент вне <Screen>');
  return info;
}

/** Позиция и размер в ячейках → CSS. Пиксели внутри TUI не используются (AGENTS.md §4.8). */
export function cellBox(x: number, y: number, w?: number, h?: number): JSX.CSSProperties {
  return {
    position: 'absolute',
    left: `calc(var(--cw) * ${x})`,
    top: `calc(var(--ch) * ${y})`,
    ...(w === undefined ? {} : { width: `calc(var(--cw) * ${w})` }),
    ...(h === undefined ? {} : { height: `calc(var(--ch) * ${h})` }),
  };
}

function viewport(): { w: number; h: number } {
  const vv = window.visualViewport;
  return { w: vv?.width ?? window.innerWidth, h: vv?.height ?? window.innerHeight };
}

/** Корень символьной сетки: меряет шрифт, считает cols × rows и масштаб, раздаёт их потомкам. */
export function Screen({ font, children }: { font: FontDef; children: (info: ScreenInfo) => ComponentChildren }) {
  const [info, setInfo] = useState<ScreenInfo | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const update = () => {
      const { w, h } = viewport();
      const m = computeMetrics(font, w, h, measureCharWidth(font, font.size));
      if (alive) setInfo({ ...m, mobile: m.cols < MIN_COLS });
    };
    void loadFont(font).then(update);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      alive = false;
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [font]);

  if (!info) return null;
  const style = {
    '--cw': `${info.cellW}px`,
    '--ch': `${info.cellH}px`,
    fontFamily: `${font.family}, monospace`,
    fontSize: `${info.fontSize}px`,
    lineHeight: `${info.cellH}px`,
    width: `calc(var(--cw) * ${info.cols})`,
    height: `calc(var(--ch) * ${info.rows})`,
    color: cssVar('fg'),
    background: cssVar('bg'),
  } as JSX.CSSProperties;

  return (
    <ScreenContext.Provider value={info}>
      <div ref={screenRef} class="tui-screen tui-pixel" style={style} data-cols={info.cols} data-rows={info.rows}>
        {children(info)}
        <MouseCursor screenRef={screenRef} />
      </div>
    </ScreenContext.Provider>
  );
}
