// Хранилище кампаний: интерфейс адаптера и схема метаданных (docs/03-architecture.md, docs/06-data-model.md).
// Реализации: `LocalAdapter` (IndexedDB, соло), позже `FirebaseAdapter` (кооп).
import { z } from 'zod';
import type { Commit, GameState } from '../engine/types';

/** Самое длинное название кампании (в символах). */
export const TITLE_MAX = 80;

export const campaignMetaSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1).max(TITLE_MAX),
  rules: z.object({ id: z.string().min(1), version: z.string().min(1), variant: z.string().min(1) }),
  narrationLang: z.enum(['ru', 'en']),
  /** Зерно RNG кампании: из него (и коммитов) восстанавливаются броски. */
  seed: z.string().min(1),
  /** `creation` — героя ещё нет, `play` — игра идёт. */
  phase: z.enum(['creation', 'play']),
  /** Номер последнего коммита (0 — журнал пуст). */
  headSeq: z.number().int().min(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type CampaignMeta = z.infer<typeof campaignMetaSchema>;
export type CampaignPhase = CampaignMeta['phase'];

export interface CampaignSnapshot {
  meta: CampaignMeta;
  /** Текущее состояние (проекция журнала). */
  state: GameState;
  /** Последние коммиты в порядке возрастания `seq`; последний нужен для продолжения RNG. */
  commits: Commit[];
}

/** Что меняется вместе с коммитом (атомарно): проекция состояния и, если надо, фаза кампании. */
export interface CommitPatch {
  state: GameState;
  phase?: CampaignPhase;
}

/** Коммит не встал в журнал: кто-то другой продвинул `headSeq` (две вкладки, два хоста). */
export class StorageConflictError extends Error {
  /** `expectedHead` — на каком коммите журнал был у пишущего, `actualHead` — на каком он сейчас. */
  constructor(
    readonly campaignId: string,
    readonly expectedHead: number,
    readonly actualHead: number,
  ) {
    super(`Конфликт записи в кампанию ${campaignId}: коммит ${expectedHead + 1} не встаёт в журнал, он уже на ${actualHead}`);
    this.name = 'StorageConflictError';
  }
}

export interface StorageAdapter {
  /** Кампании, недавно игранные — первыми. */
  listCampaigns(): Promise<CampaignMeta[]>;
  createCampaign(meta: CampaignMeta): Promise<void>;
  /** `null`, если кампании нет. `recent` — сколько последних коммитов вернуть. */
  loadCampaign(id: string, opts?: { recent?: number }): Promise<CampaignSnapshot | null>;
  /** Атомарно: коммит, проекция, `headSeq`, фаза. Бросает `StorageConflictError`, если `commit.seq` не следующий. */
  commit(campaignId: string, commit: Commit, patch: CommitPatch): Promise<CampaignMeta>;
  /** Весь журнал по возрастанию `seq` (экспорт, откат, миграция). */
  allCommits(campaignId: string): Promise<Commit[]>;
  deleteCampaign(id: string): Promise<void>;
}
