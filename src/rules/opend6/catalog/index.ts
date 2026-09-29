// Каталоги снаряжения OpenD6 по вариантам. Запись → предмет инвентаря: `catalogItem`.
import { ADVENTURE_CATALOG } from './adventure';
import { FANTASY_CATALOG } from './fantasy';
import type { CatalogEntry, CatalogKind } from './types';

export { catalogItem, type CatalogEntry, type CatalogKind, type Price } from './types';
export { ADVENTURE_CATALOG, FANTASY_CATALOG };

export const catalogFor = (variant: string): readonly CatalogEntry[] => (variant === 'fantasy' ? FANTASY_CATALOG : variant === 'adventure' ? ADVENTURE_CATALOG : []);

export const findCatalogEntry = (variant: string, id: string): CatalogEntry | undefined => catalogFor(variant).find((e) => e.id === id);

export const catalogKinds = (variant: string): CatalogKind[] => [...new Set(catalogFor(variant).map((e) => e.kind))];
