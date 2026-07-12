import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeading } from '@/components/shared/page-heading';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorState } from '@/components/shared/state-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminUsers, useChangeUserStatus } from '@/features/admin/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import type { UserRole } from '@/lib/api-types';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/roles';
import { USER_STATUS } from '@/lib/status';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';

const ROLE_FILTERS: { value: UserRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'CLIENT', label: 'Clientes' },
  { value: 'RESTAURANT_ADMIN', label: 'Restaurantes' },
  { value: 'SUPER_ADMIN', label: 'Administradores' },
];

export function AdminUsersPage() {
  useDocumentTitle('Usuarios');
  const meId = useSessionStore((s) => s.user?.id);
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL');
  const { data, isLoading, isError, refetch } = useAdminUsers(
    role === 'ALL' ? undefined : role,
  );
  const changeStatus = useChangeUserStatus();
  const users = data?.items ?? [];

  const toggle = (id: string, next: 'ACTIVE' | 'SUSPENDED') => {
    changeStatus.mutate(
      { id, status: next },
      {
        onSuccess: () =>
          toast.success(next === 'SUSPENDED' ? 'Usuario suspendido.' : 'Usuario reactivado.'),
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'No se pudo actualizar.',
          ),
      },
    );
  };

  return (
    <>
      <PageHeading
        title="Usuarios"
        description="Gestiona las cuentas de la plataforma. Suspender cierra todas las sesiones."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setRole(f.value)}
            aria-pressed={role === f.value}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              role === f.value
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border text-text-muted hover:border-primary/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {users.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === meId;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.fullName}</p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{ROLE_LABELS[u.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-text-muted">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge meta={USER_STATUS[u.status]} />
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-text-muted">Tú</span>
                      ) : u.status === 'ACTIVE' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={changeStatus.isPending}
                          onClick={() => toggle(u.id, 'SUSPENDED')}
                        >
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={changeStatus.isPending}
                          onClick={() => toggle(u.id, 'ACTIVE')}
                        >
                          Reactivar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
