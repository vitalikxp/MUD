import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createHero, session } from '../../app/campaigns';
import { setLang } from '../../app/chronicle';
import { navigate } from '../../app/router';
import { rulesModule } from '../../app/rules';
import { locale, t } from '../../i18n';
import type { CreationTemplate } from '../../rules/api';
import { FKeyBar, useFKeys, type FKey } from '../tui/FKeyBar';
import { Input } from '../tui/Input';
import { Menu, type MenuItem } from '../tui/Menu';
import { Panel } from '../tui/Panel';
import { cellBox, type ScreenInfo } from '../tui/Screen';
import { Tabs } from '../tui/Tabs';
import { fit } from '../tui/text';
import { ScrollText, type ScrollApi } from '../tui/ScrollText';
import { TextView, wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';
import { HelpDialog } from './dialogs';

type Step = 'pick' | 'name' | 'skills';

const FINISH_ID = '__finish';

/** Описание шаблона: название, рассказ, характеристики, особенности. */
function detailParagraphs(tpl: CreationTemplate): Paragraph[] {
  const lang = locale.value;
  return [
    { text: tpl.name[lang], fg: 'accent' },
    { text: tpl.description[lang] },
    { text: '' },
    { text: `${t('create.attributes')}: ${tpl.attributes.map((a) => `${a.name[lang]} ${a.code}`).join(' · ')}` },
    { text: '' },
    { text: `${t('create.traits')}: ${tpl.traits.map((x) => x[lang]).join(', ') || '—'}`, fg: 'fgDim' },
  ];
}

/** Создание героя: шаблон → имя → раскладка очков навыков. Игра начинается, когда героя записали в журнал. */
export function CreationScreen({ screen }: { screen: ScreenInfo }) {
  const { cols, rows, mobile } = screen;
  const current = session.value;
  const variant = current?.meta.rules.variant ?? '';
  const templates = useMemo(() => rulesModule.creation.templates(variant), [variant]);
  const budget = useMemo(() => rulesModule.creation.budget(variant), [variant]);
  const [step, setStep] = useState<Step>('pick');
  const [tplIndex, setTplIndex] = useState(0);
  const [name, setName] = useState('');
  const [points, setPoints] = useState<Record<string, number>>({});
  const [skillSel, setSkillSel] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [help, setHelp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<ScrollApi | null>(null);
  const tpl = templates[Math.min(tplIndex, templates.length - 1)];

  useEffect(() => { if (step !== 'name') menuRef.current?.focus(); }, [step]);

  const spent = Object.values(points).reduce((a, b) => a + b, 0);
  const left = budget.total - spent;
  const dice = (n: number): string => budget.format(n).replace(/^\+/, '') || '0';

  const back = () => {
    setError('');
    if (step === 'skills') setStep('name');
    else if (step === 'name') setStep('pick');
    else navigate({ page: 'title' });
  };

  const finish = async () => {
    if (!tpl || saving) return;
    setSaving(true);
    setError('');
    try {
      const r = await createHero({ templateId: tpl.id, name, skills: points });
      if (!r.ok) setError(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  const fkeys: FKey[] = [
    { n: 1, label: t('fkeys.help'), action: () => setHelp((v) => !v) },
    { n: 9, label: t('fkeys.lang'), action: () => setLang(locale.value === 'ru' ? 'en' : 'ru') },
    ...(step === 'skills' ? [{ n: 10, label: t('fkeys.create'), action: () => { void finish(); } }] : []),
  ];
  useFKeys(fkeys);

  if (!current || !tpl) return null;

  const panelH = mobile ? rows - 2 : rows - 1;
  const bodyW = cols - 2;
  const bodyH = panelH - 2;
  const title = `${t('create.title')} · ${current.meta.title}`;

  const bump = (index: number, delta: number, wrap = false) => {
    const skill = tpl.skills[index];
    if (!skill) return;
    const cur = points[skill.id] ?? 0;
    const cap = Math.min(budget.maxPerSkill, cur + left);
    const next = wrap && cur >= cap ? 0 : Math.min(cap, Math.max(0, cur + delta));
    setPoints((p) => ({ ...p, [skill.id]: next }));
    setError('');
  };

  const detailBuild = (w: number) => wrapParagraphs(detailParagraphs(tpl), w);
  let content;
  if (step === 'pick') {
    const items: MenuItem[] = templates.map((x) => ({ id: x.id, label: x.name[locale.value] }));
    const hint = wrapParagraphs([{ text: t('create.pickHint'), fg: 'fgDim' }], bodyW);
    const top = hint.length + 1;
    const listH = Math.min(templates.length, Math.max(3, bodyH - top - 4));
    const detailH = Math.max(3, bodyH - top - listH - 1);
    content = (
      <>
        <div style={cellBox(0, 0, bodyW, hint.length)}><TextView lines={hint} width={bodyW} height={hint.length} anchor="top" /></div>
        <div style={cellBox(0, top, bodyW, listH)}>
          <Menu items={items} selected={tplIndex} width={bodyW} height={listH} label={t('create.template')} menuRef={menuRef}
            onSelect={setTplIndex} onChoose={(i) => { setTplIndex(i); setStep('name'); }} />
        </div>
        <ScrollText key={tpl.id} apiRef={detailRef} build={detailBuild} width={bodyW} height={detailH} y={top + listH + 1} live />
      </>
    );
  } else if (step === 'name') {
    const hint = wrapParagraphs([{ text: t('create.nameHint'), fg: 'fgDim' }], bodyW);
    const wanted = detailBuild(bodyW).length;
    const detailH = Math.max(3, Math.min(wanted, bodyH - hint.length - 4)); // ниже — подсказка, поле имени и строка ошибки
    const hintY = detailH + 1;
    const inputY = hintY + hint.length + 1;
    content = (
      <>
        <ScrollText key={tpl.id} apiRef={detailRef} build={detailBuild} width={bodyW} height={detailH} />
        <div style={cellBox(0, hintY, bodyW, hint.length)}><TextView lines={hint} width={bodyW} height={hint.length} anchor="top" /></div>
        <Input x={0} y={inputY} w={bodyW} prompt={t('create.namePrompt')} placeholder="" label={t('create.hero')} initial={name} focusOnMount
          onSubmit={(v) => {
            setName(v);
            if (Array.from(v).length > budget.maxNameLength) { setError(t('create.nameTooLong', { max: budget.maxNameLength })); return; }
            setError('');
            setStep('skills');
          }} onCancel={back} />
        {error ? <div style={cellBox(0, inputY + 2, bodyW, 1)}><TextView lines={[[{ text: error, fg: 'failure' }]]} width={bodyW} height={1} anchor="top" live /></div> : null}
      </>
    );
  } else {
    const nameW = Math.min(28, Math.max(...tpl.skills.map((s) => Array.from(s.name[locale.value]).length)) + 2);
    const items: MenuItem[] = [
      ...tpl.skills.map((s) => {
        const p = points[s.id] ?? 0;
        return { id: s.id, label: `${p > 0 ? '●' : ' '} ${fit(s.name[locale.value], nameW)}`, hint: `${s.base}${p > 0 ? ` ${budget.format(p)}` : ''}` };
      }),
      { id: FINISH_ID, label: saving ? t('create.saving') : t('create.finish') },
    ];
    const head = wrapParagraphs([
      { text: `${t('create.hero')}: ${name} · ${tpl.name[locale.value]}`, fg: 'accent' },
      { text: t('create.remaining', { left: dice(left), total: dice(budget.total) }), fg: left === 0 ? 'success' : 'fg' },
    ], bodyW);
    const notes = wrapParagraphs([{ text: t('create.skillsHint'), fg: 'fgDim' }, ...(error ? [{ text: error, fg: 'failure' as const }] : [])], bodyW);
    const listH = Math.max(3, bodyH - head.length - notes.length - 2);
    content = (
      // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- ←/→, +/−, PgUp/PgDn меняют очки выбранного навыка
      <div
        // PgUp/PgDn здесь меняют очки на кубик, а не листают список: перехватываем в фазе захвата, до Menu (иначе сработают оба).
        onKeyDownCapture={(e) => {
          if (skillSel >= tpl.skills.length || (e.key !== 'PageUp' && e.key !== 'PageDown')) return;
          bump(skillSel, e.key === 'PageUp' ? 3 : -3);
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (skillSel >= tpl.skills.length) return;
          if (e.key === 'ArrowRight' || e.key === '+' || e.key === '=') bump(skillSel, 1);
          else if (e.key === 'ArrowLeft' || e.key === '-') bump(skillSel, -1);
          else return;
          e.preventDefault();
        }}>
        <div style={cellBox(0, 0, bodyW, head.length)}><TextView lines={head} width={bodyW} height={head.length} anchor="top" live /></div>
        <div style={cellBox(0, head.length + 1, bodyW, listH)}>
          <Menu items={items} selected={skillSel} width={bodyW} height={listH} label={t('create.skillHeader')} menuRef={menuRef}
            onSelect={setSkillSel} onChoose={(i) => { if (i >= tpl.skills.length) void finish(); else bump(i, 1, true); }} />
        </div>
        <div style={cellBox(0, head.length + listH + 2, bodyW, notes.length)}><TextView lines={notes} width={bodyW} height={notes.length} anchor="top" live /></div>
      </div>
    );
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Esc возвращает на шаг назад
    <div
      // На шагах «шаблон» и «имя» PgUp/PgDn листают описание шаблона (до Menu и поля ввода).
      onKeyDownCapture={(e) => {
        if (step === 'skills' || help || (e.key !== 'PageUp' && e.key !== 'PageDown')) return;
        detailRef.current?.page(e.key === 'PageUp' ? -1 : 1);
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && step !== 'name' && !help) { e.preventDefault(); back(); }
      }}>
      <Panel x={0} y={0} w={cols} h={panelH} title={title} active id="panel-creation">{content}</Panel>
      {mobile ? (
        <Tabs y={rows - 2} cols={cols} active="" onChange={(id) => { if (id === 'back') back(); else void finish(); }}
          tabs={[{ id: 'back', label: t('fkeys.back') }, ...(step === 'skills' ? [{ id: 'create', label: t('fkeys.create') }] : [])]}
          extra={{ label: '≡', ariaLabel: t('fkeys.help'), action: () => setHelp((v) => !v) }} />
      ) : (
        <FKeyBar keys={fkeys} y={rows - 1} cols={cols} />
      )}
      {help ? <HelpDialog onClose={() => setHelp(false)} /> : null}
    </div>
  );
}
