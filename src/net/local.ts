// LocalAdapter: кампании в IndexedDB браузера (соло, без аккаунта и сети).
// База `swrd`: campaigns, commits [cid, seq], projections [cid, name], settings, debugTurns [cid, turnId] (docs/06-data-model.md).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { foldCommits } from '../engine/commits';
import { initialState } from '../engine/reducer';
import type { Commit, GameState } from '../engine/types';
import { campaignMetaSchema, StorageConflictError, type CampaignMeta, type CampaignSnapshot, type CommitPatch, type StorageAdapter } from './storage';

interface CommitRow {
  cid: string;
  seq: number;
  commit: Commit;
}

interface ProjectionRow {
  cid: string;
  name: string;
  /** Номер коммита, на котором проекция актуальна. */
  atSeq: number;
  data: GameState;
}

interface SwrdDb extends DBSchema {
  campaigns: { key: string; value: CampaignMeta };
  commits: { key: [string, number]; value: CommitRow };
  projections: { key: [string, string]; value: ProjectionRow };
  settings: { key: string; value: { key: string; value: unknown } };
  debugTurns: { key: [string, string]; value: { cid: string; turnId: string; data: unknown } };
}

export const DB_NAME = 'swrd';
const DB_VERSION = 1;
const STATE = 'state';
/** По умолчанию читаем столько последних коммитов: хроника грузится с конца. */
const DEFAULT_RECENT = 200;

/** Откат транзакции: `done` при этом отклоняется с AbortError, ждём его, чтобы не осталось необработанного отказа. */
async function abortTx(tx: { abort(): void; done: Promise<void> }): Promise<void> {
  tx.abort();
  await tx.done.catch(() => undefined);
}

export class LocalAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBPDatabase<SwrdDb>> | null = null;

  constructor(private readonly name = DB_NAME) {}

  private db(): Promise<IDBPDatabase<SwrdDb>> {
    this.dbPromise ??= openDB<SwrdDb>(this.name, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('campaigns', { keyPath: 'id' });
        db.createObjectStore('commits', { keyPath: ['cid', 'seq'] });
        db.createObjectStore('projections', { keyPath: ['cid', 'name'] });
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('debugTurns', { keyPath: ['cid', 'turnId'] });
      },
    });
    return this.dbPromise;
  }

  /** Закрывает соединение (тесты, удаление базы). */
  async close(): Promise<void> {
    if (!this.dbPromise) return;
    (await this.dbPromise).close();
    this.dbPromise = null;
  }

  async listCampaigns(): Promise<CampaignMeta[]> {
    const rows = await (await this.db()).getAll('campaigns');
    const metas: CampaignMeta[] = [];
    for (const row of rows) {
      const parsed = campaignMetaSchema.safeParse(row);
      if (parsed.success) metas.push(parsed.data); // испорченную запись не показываем, но и не удаляем
    }
    return metas.toSorted((a, b) => b.updatedAt - a.updatedAt);
  }

  async createCampaign(meta: CampaignMeta): Promise<void> {
    const valid = campaignMetaSchema.parse(meta);
    const db = await this.db();
    const tx = db.transaction('campaigns', 'readwrite');
    if (await tx.store.get(valid.id)) {
      await abortTx(tx);
      throw new Error(`Кампания ${valid.id} уже есть`);
    }
    await tx.store.put(valid);
    await tx.done;
  }

  async loadCampaign(id: string, opts: { recent?: number } = {}): Promise<CampaignSnapshot | null> {
    const db = await this.db();
    const tx = db.transaction(['campaigns', 'commits', 'projections'], 'readonly');
    const raw = await tx.objectStore('campaigns').get(id);
    if (!raw) return null;
    const meta = campaignMetaSchema.parse(raw);
    const projection = await tx.objectStore('projections').get([id, STATE]);
    const rows = await tx.objectStore('commits').getAll(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    await tx.done;

    const all = rows.map((r) => r.commit);
    // Проекция актуальна, только если совпадает с головой журнала; иначе пересчитываем (журнал — источник истины).
    const state = projection && projection.atSeq === meta.headSeq ? projection.data : foldCommits(initialState(meta.rules), all);
    const recent = opts.recent ?? DEFAULT_RECENT;
    return { meta, state, commits: all.slice(-recent) };
  }

  async commit(campaignId: string, commit: Commit, patch: CommitPatch): Promise<CampaignMeta> {
    const db = await this.db();
    const tx = db.transaction(['campaigns', 'commits', 'projections'], 'readwrite');
    const raw = await tx.objectStore('campaigns').get(campaignId);
    if (!raw) {
      await abortTx(tx);
      throw new Error(`Нет кампании ${campaignId}`);
    }
    const meta = campaignMetaSchema.parse(raw);
    if (commit.seq !== meta.headSeq + 1) {
      await abortTx(tx);
      throw new StorageConflictError(campaignId, commit.seq - 1, meta.headSeq);
    }
    const next: CampaignMeta = { ...meta, headSeq: commit.seq, phase: patch.phase ?? meta.phase, updatedAt: commit.createdAt };
    await tx.objectStore('commits').add({ cid: campaignId, seq: commit.seq, commit });
    await tx.objectStore('projections').put({ cid: campaignId, name: STATE, atSeq: commit.seq, data: patch.state });
    await tx.objectStore('campaigns').put(next);
    await tx.done;
    return next;
  }

  async allCommits(campaignId: string): Promise<Commit[]> {
    const rows = await (await this.db()).getAll('commits', IDBKeyRange.bound([campaignId, 0], [campaignId, Number.MAX_SAFE_INTEGER]));
    return rows.map((r) => r.commit);
  }

  async deleteCampaign(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['campaigns', 'commits', 'projections', 'debugTurns'], 'readwrite');
    await tx.objectStore('campaigns').delete(id);
    await tx.objectStore('commits').delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    await tx.objectStore('projections').delete(IDBKeyRange.bound([id, ''], [id, '￿']));
    await tx.objectStore('debugTurns').delete(IDBKeyRange.bound([id, ''], [id, '￿']));
    await tx.done;
  }
}
