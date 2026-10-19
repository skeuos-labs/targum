import type { ReactNode } from 'react';
import type { ReviewTabProps } from './types';
import { OverviewTab } from './OverviewTab';
import { SectionsTab } from './SectionsTab';
import { SlidesTab } from './SlidesTab';
import { WarningsTab } from './WarningsTab';
import { JsonTab } from './JsonTab';

export interface ReviewTabBadgeCtx {
  warningCount: number;
}

export interface ReviewTabDef {
  readonly id: string;
  readonly label: string;
  readonly Component: (props: ReviewTabProps) => ReactNode;
  /** Return a count to show as chip; omit chip when null/undefined/0. */
  readonly badge?: (ctx: ReviewTabBadgeCtx) => number | null | undefined;
}

export const REVIEW_TABS = [
  { id: 'overview', label: 'Overview', Component: OverviewTab },
  { id: 'sections', label: 'Sections', Component: SectionsTab },
  { id: 'slides', label: 'Slides', Component: SlidesTab },
  {
    id: 'warnings',
    label: 'Warnings',
    Component: WarningsTab,
    badge: (ctx: ReviewTabBadgeCtx) => ctx.warningCount,
  },
  { id: 'json', label: 'Raw JSON', Component: JsonTab },
] as const satisfies readonly ReviewTabDef[];

export type ReviewTab = (typeof REVIEW_TABS)[number]['id'];

export const DEFAULT_REVIEW_TAB: ReviewTab = 'overview';

export function reviewTabBadge(
  tab: ReviewTabDef,
  ctx: ReviewTabBadgeCtx
): number | null | undefined {
  return tab.badge?.(ctx);
}
