import { ErrorState } from '@/components/shared/state-message';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks';
import { ROLE_LABELS } from '@/lib/roles';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{value}</dd>
    </div>
  );
}

/** Account details from `GET /auth/me` — a real, authenticated round-trip. */
export function AccountSummaryCard() {
  const { data, isLoading, isError, refetch } = useMe();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Datos de tu cuenta</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        )}
        {isError && (
          <ErrorState
            title="No pudimos cargar tu cuenta"
            onRetry={() => refetch()}
          />
        )}
        {data && (
          <dl>
            <Row label="Nombre" value={data.fullName} />
            <Row label="Correo" value={data.email} />
            <Row label="Teléfono" value={data.phone ?? '—'} />
            <Row label="Rol" value={ROLE_LABELS[data.role]} />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
