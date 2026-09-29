// Компактное описание персонажа для промпта Мастера (английский, с id навыков и характеристик, как в схемах инструментов).
import { formatDieCode, toPips } from './dice';
import type { Entity } from '../../engine/types';
import { attributeCode, readCharacter, skillCode, woundLevel } from './character';
import { getVariant } from './data';
import { WOUND_NAMES } from './sheet';

export function describeForPrompt(entity: Entity): string {
  const parsed = readCharacter(entity);
  const head = `${entity.name} (id: ${entity.id}, ${entity.kind === 'pc' ? 'player hero' : 'NPC'})`;
  if (!parsed.ok) return `${head} — data error: ${parsed.error}`;
  const data = parsed.value;
  const variant = getVariant(data.variant)!;
  const level = woundLevel(data.body.points, data.body.max);
  const attributes = variant.attributes
    .filter((a) => toPips(attributeCode(data, a.id)) > 0)
    .map((a) => `${a.id} ${formatDieCode(attributeCode(data, a.id))}`)
    .join(', ');
  const skills = Object.keys(data.skills)
    .map((id) => `${id} ${formatDieCode(skillCode(data, variant, id)!)}`)
    .join(', ');
  const parts = [
    `${head}${data.concept ? ` — ${data.concept}` : ''}`,
    `  Attributes: ${attributes}.`,
    `  Trained skills (total codes): ${skills || 'none'}. Untrained skills roll the bare attribute.`,
    `  Body Points ${data.body.points}/${data.body.max} (${WOUND_NAMES[level.id].en}${level.penaltyDice > 0 ? `, -${level.penaltyDice}D to rolls` : ''}). Character Points ${data.points.cp}, Fate Points ${data.points.fp}.`,
  ];
  if (data.funds || data.silver !== undefined) parts.push(`  Funds ${data.funds ?? '—'}${data.silver !== undefined ? `, silver ${data.silver}` : ''}.`);
  if (data.traits.length > 0) parts.push(`  Traits: ${data.traits.map((t) => `${t.name.en}${t.rank ? ` R${t.rank}` : ''} (${t.kind}: ${t.text.en})`).join('; ')}.`);
  parts.push(`  Items: ${entity.items.map((i) => `${i.name} [id ${i.id}]${i.qty > 1 ? ` x${i.qty}` : ''}${i.slot ? ` (${i.slot})` : ''}`).join(', ') || 'none'}.`);
  if (entity.conditions.length > 0) parts.push(`  Conditions: ${entity.conditions.join(', ')}.`);
  return parts.join('\n');
}
