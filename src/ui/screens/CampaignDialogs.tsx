import { useEffect, useRef, useState } from 'preact/hooks';
import { createCampaign, deleteCampaign } from '../../app/campaigns';
import { rulesModule } from '../../app/rules';
import { navigate } from '../../app/router';
import { locale, t } from '../../i18n';
import { TITLE_MAX, type CampaignMeta } from '../../net/storage';
import { Dialog } from '../tui/Dialog';
import { Form, type Field } from '../tui/Form';
import { cellBox, useScreen } from '../tui/Screen';
import { TextView, wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';

/** Новая кампания (F3): название и вариант правил. Мир и завязку придумает Мастер. */
export function NewCampaignDialog({ onClose }: { onClose: () => void }) {
  const { cols } = useScreen();
  const formRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(t('campaign.defaultTitle'));
  const [variant, setVariant] = useState(rulesModule.variants[0]!.id);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { formRef.current?.focus(); }, []);

  const create = async () => {
    if (busy) return;
    if (!title.trim()) {
      setError(t('campaign.needName'));
      return;
    }
    if (Array.from(title.trim()).length > TITLE_MAX) {
      setError(t('campaign.nameTooLong', { max: TITLE_MAX }));
      return;
    }
    setBusy(true);
    try {
      const id = await createCampaign({ title, variant, lang: locale.value });
      onClose();
      navigate({ page: 'game', id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const fields: Field[] = [
    { id: 'title', label: t('campaign.name'), kind: 'text', value: title, onChange: setTitle },
    { id: 'variant', label: t('campaign.variant'), kind: 'choice', value: variant,
      options: rulesModule.variants.map((v) => ({ value: v.id, label: v.name[locale.value] })), onChange: setVariant },
    { id: 'create', label: t('campaign.create'), kind: 'action', onRun: () => { void create(); } },
  ];
  const w = Math.min(cols - 2, 60);
  const bodyW = w - 2;
  const notes: Paragraph[] = [{ text: t('campaign.hint'), fg: 'fgDim' }];
  if (error) notes.push({ text: '' }, { text: error, fg: 'failure' });
  const lines = wrapParagraphs(notes, bodyW);
  const h = fields.length + 2 + 1 + lines.length;
  return (
    <Dialog title={t('campaign.newTitle')} w={w} h={h} onClose={onClose} separators={[fields.length + 1]}>
      <Form fields={fields} width={bodyW} label={t('campaign.newTitle')} formRef={formRef} />
      <div style={cellBox(0, fields.length + 1, bodyW, lines.length)}>
        <TextView lines={lines} width={bodyW} height={lines.length} anchor="top" live />
      </div>
    </Dialog>
  );
}

/** Подтверждение удаления. Фокус сразу на «Отмена»: случайный Enter ничего не удаляет. */
export function DeleteCampaignDialog({ campaign, onClose }: { campaign: CampaignMeta; onClose: () => void }) {
  const { cols } = useScreen();
  const formRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => { formRef.current?.focus(); }, []);

  const w = Math.min(cols - 2, 56);
  const bodyW = w - 2;
  const lines = wrapParagraphs([{ text: t('campaign.deleteQuestion', { title: campaign.title }) }, ...(error ? [{ text: error, fg: 'failure' as const }] : [])], bodyW);
  const fields: Field[] = [
    { id: 'no', label: t('campaign.deleteNo'), kind: 'action', onRun: onClose },
    { id: 'yes', label: t('campaign.deleteYes'), kind: 'action', onRun: () => {
      deleteCampaign(campaign.id).then(onClose, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    } },
  ];
  return (
    <Dialog title={t('campaign.deleteTitle')} w={w} h={lines.length + fields.length + 3} onClose={onClose} separators={[lines.length + 1]}>
      <TextView lines={lines} width={bodyW} height={lines.length} anchor="top" live />
      <div style={cellBox(0, lines.length + 1, bodyW, fields.length)}>
        <Form fields={fields} width={bodyW} label={t('campaign.deleteTitle')} formRef={formRef} />
      </div>
    </Dialog>
  );
}
