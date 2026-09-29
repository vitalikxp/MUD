import { useEffect, useState } from 'preact/hooks';
import { heroOf, session } from '../../app/campaigns';
import { rulesModule } from '../../app/rules';
import { locale, t } from '../../i18n';
import { detailLines, itemLabel, summaryLines } from '../screens/inventoryLines';
import { Menu, type MenuItem } from '../tui/Menu';
import { cellBox } from '../tui/Screen';
import { TextView } from '../tui/TextView';

/**
 * Вещи героя: сводка (деньги), список предметов (↑↓, Enter — меню действий), свойства выбранного предмета под списком.
 * Общий для панели справа и окна F3. Меню действий открывает родитель (`onOpen`): оно должно рисоваться на уровне экрана, а не внутри панели.
 * `onEscape` — для панели: вернуть фокус в строку ввода (в окне Esc закрывает само окно).
 * `onEmpty` — выбросили последний предмет: список исчез вместе с фокусом, родитель забирает его себе (иначе клавиши уходят в никуда).
 */
export function InventoryList({ width, height, listRef, onOpen, onEscape, onEmpty }: {
  width: number;
  height: number;
  listRef: { current: HTMLDivElement | null };
  onOpen: (itemId: string) => void;
  onEscape?: () => void;
  onEmpty?: () => void;
}) {
  const [sel, setSel] = useState(0);
  const hero = session.value ? heroOf(session.value.state) : undefined;
  const view = hero ? rulesModule.inventory(hero, locale.value) : null;
  const empty = view !== null && view.rows.length === 0;
  useEffect(() => {
    if (empty && (document.activeElement === document.body || document.activeElement === null)) onEmpty?.();
  }, [empty, onEmpty]);
  if (!view) return <TextView lines={[[{ text: t('sheet.noHero'), fg: 'warning' }]]} width={width} height={height} anchor="top" />;

  const summary = summaryLines(view);
  const summaryH = summary.length > 0 ? summary.length + 1 : 0;
  const selected = Math.min(sel, Math.max(0, view.rows.length - 1));
  const details = detailLines(view.rows[selected], width).slice(0, 2);
  const detailH = height >= summaryH + 5 ? 2 : 0; // в тесной панели свойства уступают место списку
  const listH = Math.max(1, height - summaryH - detailH);
  const items: MenuItem[] = view.rows.map((r) => ({ id: r.id, label: itemLabel(r), ...(r.slotLabel ? { hint: `[${r.slotLabel}]` } : {}), ...(r.worn ? { fg: 'success' as const } : {}) }));

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Esc в панели возвращает фокус в строку ввода; клавиши списка обрабатывает Menu
    <div onKeyDown={(e) => { if (e.key === 'Escape' && onEscape) { e.preventDefault(); onEscape(); } }}>
      {summaryH > 0 ? (
        <div style={cellBox(0, 0, width, summary.length)}>
          <TextView lines={summary} width={width} height={summary.length} anchor="top" />
        </div>
      ) : null}
      <div style={cellBox(0, summaryH, width, listH)}>
        {items.length === 0 ? (
          <TextView lines={[[{ text: t('inventory.empty'), fg: 'fgDim' }]]} width={width} height={1} anchor="top" />
        ) : (
          <Menu items={items} selected={selected} width={width} height={listH} label={t('panels.inventory')} menuRef={listRef}
            onSelect={setSel} onChoose={(i) => { const row = view.rows[i]; if (row) onOpen(row.id); }} />
        )}
      </div>
      {detailH > 0 ? (
        <div style={cellBox(0, summaryH + listH, width, detailH)}>
          <TextView lines={details} width={width} height={detailH} anchor="top" />
        </div>
      ) : null}
    </div>
  );
}
