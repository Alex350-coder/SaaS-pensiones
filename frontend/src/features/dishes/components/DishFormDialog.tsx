import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import type { DishCategory, DishView } from '@/lib/api-types';
import { cn } from '@/lib/utils';
import { useCreateDish, useUpdateDish } from '../hooks';

const CATEGORIES: { value: DishCategory; label: string }[] = [
  { value: 'STARTER', label: 'Entrada' },
  { value: 'MAIN', label: 'Principal' },
  { value: 'BEVERAGE', label: 'Bebida' },
  { value: 'DESSERT', label: 'Postre' },
];

const dishSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.enum(['STARTER', 'MAIN', 'BEVERAGE', 'DESSERT']),
  price: z
    .number({ message: 'Ingresa un precio válido.' })
    .min(0, 'No puede ser negativo.')
    .max(99_999_999.99),
  imageUrl: z.union([z.string().trim().url('URL inválida.'), z.literal('')]),
  isActive: z.boolean(),
});

type DishFormValues = z.infer<typeof dishSchema>;

const emptyValues: DishFormValues = {
  name: '',
  description: '',
  category: 'MAIN',
  price: 0,
  imageUrl: '',
  isActive: true,
};

interface DishFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dish?: DishView | null;
}

export function DishFormDialog({ open, onOpenChange, dish }: DishFormDialogProps) {
  const isEdit = Boolean(dish);
  const create = useCreateDish();
  const update = useUpdateDish();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DishFormValues>({
    resolver: zodResolver(dishSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      dish
        ? {
            name: dish.name,
            description: dish.description ?? '',
            category: dish.category,
            price: dish.price,
            imageUrl: dish.imageUrl ?? '',
            isActive: dish.isActive,
          }
        : emptyValues,
    );
  }, [open, dish, reset]);

  const category = watch('category');
  const pending = create.isPending || update.isPending;

  const onSubmit = (values: DishFormValues) => {
    const payload = {
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : null,
      category: values.category,
      price: values.price,
      imageUrl: values.imageUrl ? values.imageUrl : null,
      isActive: values.isActive,
    };
    const run = isEdit
      ? update.mutateAsync({ id: dish!.id, input: payload })
      : create.mutateAsync(payload);
    run
      .then(() => {
        toast.success(isEdit ? 'Plato actualizado.' : 'Plato creado.');
        onOpenChange(false);
      })
      .catch((error) =>
        toast.error(
          error instanceof ApiError ? error.message : 'No se pudo guardar.',
        ),
      );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar plato' : 'Nuevo plato'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <TextField
            id="dish-name"
            label="Nombre"
            required
            registration={register('name')}
            error={errors.name?.message}
          />

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setValue('category', c.value)}
                  aria-pressed={category === c.value}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    category === c.value
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-text-muted hover:border-primary/40',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <TextField
            id="dish-price"
            label="Precio (S/)"
            type="number"
            step="0.01"
            min="0"
            required
            registration={register('price', { valueAsNumber: true })}
            error={errors.price?.message}
          />

          <div className="space-y-1.5">
            <Label htmlFor="dish-description">Descripción (opcional)</Label>
            <Textarea
              id="dish-description"
              rows={2}
              className="resize-none"
              {...register('description')}
            />
          </div>

          <TextField
            id="dish-image"
            label="URL de imagen (opcional)"
            placeholder="https://…"
            registration={register('imageUrl')}
            error={errors.imageUrl?.message}
          />

          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="size-4 rounded border-border text-primary"
              {...register('isActive')}
            />
            Plato activo (disponible para menús)
          </label>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
