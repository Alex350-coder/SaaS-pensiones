import { Badge } from '@/components/ui/badge';
import type { StatusMeta } from '@/lib/status';

/** Renders a status pill from a `{ label, variant }` meta entry. */
export function StatusBadge({ meta }: { meta: StatusMeta }) {
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
