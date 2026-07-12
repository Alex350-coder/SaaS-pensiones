import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeading } from '@/components/shared/page-heading';
import { ErrorState } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuEditor } from '@/features/owner-menus/components/MenuEditor';
import {
  isMenuNotFound,
  useCreateMenu,
  useOwnerMenu,
} from '@/features/owner-menus/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function CreateMenuCard({ date }: { date: string }) {
  const create = useCreateMenu();
  const [price, setPrice] = useState('15');

  const handleCreate = () => {
    create.mutate(
      { menuDate: date, menuPrice: Number(price) },
      {
        onSuccess: () => toast.success('Menú creado en borrador.'),
        onError: (error) =>
          toast.error(
            error instanceof ApiError ? error.message : 'No se pudo crear el menú.',
          ),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sin menú para esta fecha</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted">
          Crea el menú del día (en borrador) y luego añade los platos.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-menu-price">Precio del menú (S/)</Label>
            <Input
              id="new-menu-price"
              type="number"
              step="0.01"
              min="0.01"
              className="w-36"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <Button loading={create.isPending} onClick={handleCreate}>
            Crear menú
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MenusPage() {
  useDocumentTitle('Menús diarios');
  const [date, setDate] = useState(todayIso());
  const menu = useOwnerMenu(date);

  return (
    <>
      <PageHeading
        title="Menús diarios"
        description="Arma y publica el menú del día. Solo los publicados son visibles para los clientes."
      />

      <div className="mb-6 max-w-xs space-y-1.5">
        <Label htmlFor="menu-date">Fecha</Label>
        <Input
          id="menu-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {menu.isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
      {menu.isError && isMenuNotFound(menu.error) && <CreateMenuCard date={date} />}
      {menu.isError && !isMenuNotFound(menu.error) && (
        <ErrorState onRetry={() => menu.refetch()} />
      )}
      {menu.data && <MenuEditor menu={menu.data} />}
    </>
  );
}
