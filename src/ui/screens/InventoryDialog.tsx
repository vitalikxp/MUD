import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { InventoryList } from '../panels/InventoryList';
import { Dialog } from '../tui/Dialog';
import { cellBox, useScreen } from '../tui/Screen';
import { fit } from '../tui/text';
import { TextView } from '../tui/TextView';

/** Вещи (F3 на узком экране, вкладка «Вещи» на телефоне): тот же список с действиями, что в панели. Esc закрывает. */
export function InventoryDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (itemId: string) => void }) {
  const { cols, rows } = useScreen();
  const listRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { listRef.current?.focus(); }, []);
  const w = Math.min(cols - 2, 64);
  const h = Math.min(rows - 2, 30);
  const bodyW = w - 2;
  const textH = h - 4;

  return (
    <Dialog title={t('panels.inventory')} w={w} h={h} onClose={onClose} separators={[h - 3]}>
      {/* Обёртка забирает фокус, когда список опустел: Esc окна работает, пока фокус внутри окна. */}
      <div ref={boxRef} tabIndex={-1} style={{ outline: 'none' }}>
        <InventoryList width={bodyW} height={textH} listRef={listRef} onOpen={onOpen} onEmpty={() => boxRef.current?.focus()} />
      </div>
      <div style={cellBox(0, h - 3, bodyW, 1)}>
        <TextView lines={[[{ text: fit(t('inventory.hint'), bodyW), fg: 'fgDim' }]]} width={bodyW} height={1} anchor="top" />
      </div>
    </Dialog>
  );
}
