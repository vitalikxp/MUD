import { cssVar } from '../../theme/palettes';
import { cellBox } from './Screen';
import { Row } from './TextView';
import type { Line } from './types';

/** Строка состояния во всю ширину сетки на фоне `bgAlt`. Содержимое уже уложено в `cols` ячеек (см. `layoutStatus`). */
export function StatusBar({ line, y, cols, label }: { line: Line; y: number; cols: number; label: string }) {
  return (
    <footer class="tui-statusbar" aria-label={label} style={{ ...cellBox(0, y, cols, 1), background: cssVar('bgAlt') }}>
      <Row line={line} width={cols} />
    </footer>
  );
}
