import { Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeading } from '@/components/shared/page-heading';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
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
import { DishFormDialog } from '@/features/dishes/components/DishFormDialog';
import { useDeleteDish, useDishes } from '@/features/dishes/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import type { DishCategory, DishView } from '@/lib/api-types';
import { formatCurrency } from '@/lib/format';

const CATEGORY_LABEL: Record<DishCategory, string> = {
  STARTER: 'Entrada',
  MAIN: 'Principal',
  BEVERAGE: 'Bebida',
  DESSERT: 'Postre',
};

export function DishesPage() {
  useDocumentTitle('Platos');
  const { data, isLoading, isError, refetch } = useDishes();
  const deleteDish = useDeleteDish();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DishView | null>(null);
  const [deleting, setDeleting] = useState<DishView | null>(null);

  const dishes = data?.items ?? [];

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (dish: DishView) => {
    setEditing(dish);
    setFormOpen(true);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteDish.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Plato eliminado.');
        setDeleting(null);
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : 'No se pudo eliminar el plato.',
        );
        setDeleting(null);
      },
    });
  };

  return (
    <>
      <PageHeading
        title="Platos"
        description="Gestiona tu carta. Los platos activos pueden componer los menús diarios."
        actions={
          <Button onClick={openNew}>
            <Plus aria-hidden="true" />
            Nuevo plato
          </Button>
        }
      />

      {isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && dishes.length === 0 && (
        <StateMessage
          icon={UtensilsCrossed}
          title="Aún no tienes platos"
          description="Crea tu primer plato para empezar a armar menús."
          action={<Button onClick={openNew}>Nuevo plato</Button>}
        />
      )}

      {dishes.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plato</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dishes.map((dish) => (
                <TableRow key={dish.id}>
                  <TableCell>
                    <p className="font-medium">{dish.name}</p>
                    {dish.description && (
                      <p className="max-w-xs truncate text-xs text-text-muted">
                        {dish.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-text-muted">
                    {CATEGORY_LABEL[dish.category]}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(dish.price)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={dish.isActive ? 'success' : 'neutral'}>
                      {dish.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${dish.name}`}
                        onClick={() => openEdit(dish)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${dish.name}`}
                        onClick={() => setDeleting(dish)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DishFormDialog open={formOpen} onOpenChange={setFormOpen} dish={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar plato?"
        description="Si el plato ya se usó en un menú no podrá eliminarse; en ese caso desactívalo."
        confirmLabel="Eliminar"
        danger
        loading={deleteDish.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
