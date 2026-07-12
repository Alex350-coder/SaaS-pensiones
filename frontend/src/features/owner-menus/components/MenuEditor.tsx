import { Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDishes } from '@/features/dishes/hooks';
import { ApiError } from '@/lib/api-client';
import type { DishCategory, DishView, OwnerMenuView } from '@/lib/api-types';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useChangeMenuStatus,
  useDeleteMenu,
  useReplaceMenuItems,
  useUpdateMenuPrice,
} from '../hooks';

const CATEGORY_ORDER: DishCategory[] = ['STARTER', 'MAIN', 'BEVERAGE', 'DESSERT'];
const CATEGORY_LABEL: Record<DishCategory, string> = {
  STARTER: 'Entradas',
  MAIN: 'Principales',
  BEVERAGE: 'Bebidas',
  DESSERT: 'Postres',
};
const MENU_STATUS = {
  DRAFT: { label: 'Borrador', variant: 'warning' as const },
  PUBLISHED: { label: 'Publicado', variant: 'success' as const },
};

export function MenuEditor({ menu }: { menu: OwnerMenuView }) {
  const isDraft = menu.status === 'DRAFT';
  const dishesQuery = useDishes();
  const activeDishes = (dishesQuery.data?.items ?? []).filter((d) => d.isActive);

  const updatePrice = useUpdateMenuPrice();
  const replaceItems = useReplaceMenuItems();
  const changeStatus = useChangeMenuStatus();
  const deleteMenu = useDeleteMenu();

  const [price, setPrice] = useState(String(menu.menuPrice));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(menu.items.map((i) => i.dish.id)),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-sync to server state after a save/refetch or when switching dates.
  useEffect(() => {
    setSelected(new Set(menu.items.map((i) => i.dish.id)));
    setPrice(String(menu.menuPrice));
  }, [menu.items, menu.menuPrice]);

  const byCategory = useMemo(() => {
    const map = new Map<DishCategory, DishView[]>();
    for (const dish of activeDishes) {
      const list = map.get(dish.category) ?? [];
      list.push(dish);
      map.set(dish.category, list);
    }
    return map;
  }, [activeDishes]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onError = (error: unknown) =>
    toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar.');

  const saveItems = () => {
    const items = activeDishes
      .filter((d) => selected.has(d.id))
      .map((d) => ({ dishId: d.id, course: d.category }));
    replaceItems.mutate(
      { date: menu.menuDate, items },
      {
        onSuccess: () => toast.success('Composición guardada.'),
        onError,
      },
    );
  };

  const savePrice = () => {
    updatePrice.mutate(
      { date: menu.menuDate, menuPrice: Number(price) },
      { onSuccess: () => toast.success('Precio actualizado.'), onError },
    );
  };

  const setStatus = (status: 'DRAFT' | 'PUBLISHED') => {
    changeStatus.mutate(
      { date: menu.menuDate, status },
      {
        onSuccess: () =>
          toast.success(status === 'PUBLISHED' ? 'Menú publicado.' : 'Menú en borrador.'),
        onError,
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Menú del día</CardTitle>
        <StatusBadge meta={MENU_STATUS[menu.status]} />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="menu-price">Precio del menú (S/)</Label>
            <Input
              id="menu-price"
              type="number"
              step="0.01"
              min="0.01"
              className="w-36"
              disabled={!isDraft}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          {isDraft && Number(price) !== menu.menuPrice && (
            <Button
              variant="secondary"
              size="sm"
              loading={updatePrice.isPending}
              onClick={savePrice}
            >
              <Save aria-hidden="true" />
              Guardar precio
            </Button>
          )}
        </div>

        {isDraft ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-text">
              Composición{' '}
              <span className="text-text-muted">
                ({selected.size}/12 platos)
              </span>
            </p>
            {activeDishes.length === 0 ? (
              <p className="text-sm text-text-muted">
                No tienes platos activos. Crea platos primero.
              </p>
            ) : (
              CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
                <div key={category}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {CATEGORY_LABEL[category]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {byCategory.get(category)!.map((dish) => (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => toggle(dish.id)}
                        aria-pressed={selected.has(dish.id)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm transition-colors',
                          selected.has(dish.id)
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-border text-text-muted hover:border-primary/40',
                        )}
                      >
                        {dish.name}
                        <span className="ml-1.5 text-xs opacity-70">
                          {formatCurrency(dish.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={replaceItems.isPending}
              onClick={saveItems}
            >
              <Save aria-hidden="true" />
              Guardar platos
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {menu.items.map((item) => (
              <li key={item.id} className="px-3 py-2 text-sm">
                <span className="text-xs uppercase text-text-muted">
                  {CATEGORY_LABEL[item.course]}
                </span>{' '}
                — {item.dish.name}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {isDraft ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden="true" />
                Eliminar
              </Button>
              <Button
                size="sm"
                disabled={menu.items.length === 0}
                loading={changeStatus.isPending}
                onClick={() => setStatus('PUBLISHED')}
              >
                Publicar
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              loading={changeStatus.isPending}
              onClick={() => setStatus('DRAFT')}
            >
              Pasar a borrador
            </Button>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar el menú de este día?"
        confirmLabel="Eliminar"
        danger
        loading={deleteMenu.isPending}
        onConfirm={() =>
          deleteMenu.mutate(menu.menuDate, {
            onSuccess: () => {
              toast.success('Menú eliminado.');
              setConfirmDelete(false);
            },
            onError,
          })
        }
      />
    </Card>
  );
}
