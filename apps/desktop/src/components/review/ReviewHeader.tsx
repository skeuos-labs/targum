import type { CenterTab } from '../../state/uiStore';
import { TabsList, TabsTrigger } from '../ui/tabs';
import { OverflowMenu } from './OverflowMenu';

/** Slim tab bar: Content | Details | overflow ⋯. */
export function ReviewHeader({
  onValueChange,
}: {
  onValueChange: (tab: CenterTab) => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 pt-3">
      <TabsList
        variant="line"
        className="h-auto w-auto justify-start gap-4 rounded-none bg-transparent p-0"
      >
        <TabsTrigger
          value="content"
          onClick={() => onValueChange('content')}
          className="border-b-2 border-transparent pb-2.5 text-xs font-semibold uppercase tracking-wider data-active:border-primary data-active:text-primary"
        >
          Content
        </TabsTrigger>
        <TabsTrigger
          value="details"
          onClick={() => onValueChange('details')}
          className="border-b-2 border-transparent pb-2.5 text-xs font-semibold uppercase tracking-wider data-active:border-primary data-active:text-primary"
        >
          Details
        </TabsTrigger>
      </TabsList>

      <div className="pb-1.5">
        <OverflowMenu />
      </div>
    </header>
  );
}
