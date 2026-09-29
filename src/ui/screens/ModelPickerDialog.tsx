import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as llm from '../../app/llm';
import { modelList, refreshModels } from '../../app/models';
import { locale, t, type Key } from '../../i18n';
import { arrangeModels, type ModelChoice, type ModelLevel } from '../../llm/models';
import type { Token } from '../../theme/palettes';
import { Dialog } from '../tui/Dialog';
import { Menu, type MenuItem } from '../tui/Menu';
import { cellBox, useScreen } from '../tui/Screen';
import { ScrollText } from '../tui/ScrollText';
import { TextView, wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';

const LEVEL_TOKEN: Record<ModelLevel, Token | undefined> = { good: 'success', caveats: 'warning', unchecked: undefined, bad: 'failure' };
const LEVEL_MARK: Record<ModelLevel, string> = { good: '●', caveats: '●', unchecked: '○', bad: '×' };

/** Пояснение к выбранной модели: наша заметка или «не проверяли», плюс предупреждения о формате и списке провайдера. */
function notesFor(c: ModelChoice | undefined): Paragraph[] {
  if (!c) return [];
  const out: Paragraph[] = [c.note ? { text: c.note[locale.value] } : { text: t('models.unchecked'), fg: 'fgDim' }];
  if (c.unsupported) out.push({ text: t('models.unsupported'), fg: 'failure' });
  if (c.offline) out.push({ text: t('models.offline'), fg: 'warning' });
  return out;
}

/** Выбор модели Мастера из всех моделей провайдера. Проверенные нами идут первыми и цветом; остальные — по алфавиту. */
export function ModelPickerDialog({ onClose }: { onClose: () => void }) {
  const { cols, rows } = useScreen();
  const menuRef = useRef<HTMLDivElement>(null);
  const list = modelList.value;
  const available = list.status === 'ok' ? list.ids : null;
  const status = list.status === 'idle' ? 'nokey' : list.status;
  const failure = list.status === 'error' ? list.reason : '';
  const provider = llm.provider.value;

  useEffect(() => {
    menuRef.current?.focus();
    refreshModels(); // список уже загружен после ввода ключа; здесь повторяется только неудачная загрузка
  }, []);

  const choices = useMemo(() => arrangeModels(provider, available), [provider, available]);
  const current = llm.dmModel.value;
  const [sel, setSel] = useState(-1);
  const selected = Math.min(sel >= 0 ? sel : Math.max(0, choices.findIndex((c) => c.id === current)), choices.length - 1);

  const w = Math.min(cols - 2, 76);
  const h = Math.min(rows - 2, 30);
  const bodyW = w - 2;
  const noteH = 5;
  const listH = Math.max(3, h - 2 - noteH - 2);

  const items: MenuItem[] = choices.map((c) => ({
    id: c.id,
    label: `${LEVEL_MARK[c.level]} ${c.id}${c.id === current ? ' •' : ''}`,
    hint: c.level === 'unchecked' ? '' : t(`models.level.${c.level}` as Key),
    ...(LEVEL_TOKEN[c.level] ? { fg: LEVEL_TOKEN[c.level]! } : {}),
  }));

  const choose = (index: number) => {
    const c = choices[index];
    if (!c) return;
    llm.modelOverride.value = c.id;
    onClose();
  };

  const focus = choices[selected];
  const statusLine =
    status === 'loading' ? { text: t('models.loading'), fg: 'info' as const }
    : status === 'nokey' ? { text: t('models.nokey'), fg: 'warning' as const }
    : status === 'error' ? { text: t('models.error', { reason: failure }), fg: 'failure' as const }
    : { text: t('models.count', { n: available?.length ?? 0 }), fg: 'fgDim' as const };

  return (
    <Dialog title={t('models.title')} w={w} h={h} onClose={onClose} separators={[listH + 1]}>
      <div style={cellBox(0, 0, bodyW, listH)}>
        <Menu items={items} selected={selected} width={bodyW} height={listH} label={t('models.title')} menuRef={menuRef} onSelect={setSel} onChoose={choose} />
      </div>
      <ScrollText y={listH + 1} width={bodyW} height={noteH} build={(width) => wrapParagraphs(notesFor(focus), width)} live />
      <div style={cellBox(0, listH + noteH + 1, bodyW, 1)}>
        <TextView lines={wrapParagraphs([statusLine], bodyW).slice(0, 1)} width={bodyW} height={1} anchor="top" live />
      </div>
    </Dialog>
  );
}
