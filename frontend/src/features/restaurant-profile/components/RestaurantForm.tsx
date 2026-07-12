import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import type { OwnerRestaurantView } from '@/lib/api-types';
import { useCreateOwnRestaurant, useUpdateOwnRestaurant } from '../hooks';
import type { RestaurantProfileInput } from '../api';

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120),
  description: z
    .string()
    .trim()
    .min(10, 'Mínimo 10 caracteres.')
    .max(2000),
  address: z.string().trim().min(5, 'Mínimo 5 caracteres.').max(255),
  contactPhone: z.string().trim().min(6, 'Teléfono inválido.'),
  contactEmail: z.string().trim().email('Correo inválido.'),
  monthlyPensionPrice: z
    .number({ message: 'Ingresa un precio válido.' })
    .min(0.01, 'Debe ser mayor a 0.')
    .max(99_999_999.99),
  logoUrl: z.union([z.string().trim().url('URL inválida.'), z.literal('')]),
  coverImageUrl: z.union([z.string().trim().url('URL inválida.'), z.literal('')]),
});

type FormValues = z.infer<typeof schema>;

export function RestaurantForm({
  restaurant,
}: {
  restaurant?: OwnerRestaurantView;
}) {
  const isEdit = Boolean(restaurant);
  const create = useCreateOwnRestaurant();
  const update = useUpdateOwnRestaurant();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: restaurant?.name ?? '',
      description: restaurant?.description ?? '',
      address: restaurant?.address ?? '',
      contactPhone: restaurant?.contactPhone ?? '',
      contactEmail: restaurant?.contactEmail ?? '',
      monthlyPensionPrice: restaurant?.monthlyPensionPrice ?? 0,
      logoUrl: restaurant?.logoUrl ?? '',
      coverImageUrl: restaurant?.coverImageUrl ?? '',
    },
  });

  const pending = create.isPending || update.isPending;

  const onSubmit = (values: FormValues) => {
    const payload: RestaurantProfileInput = {
      name: values.name,
      description: values.description,
      address: values.address,
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail,
      monthlyPensionPrice: values.monthlyPensionPrice,
      ...(values.logoUrl ? { logoUrl: values.logoUrl } : {}),
      ...(values.coverImageUrl ? { coverImageUrl: values.coverImageUrl } : {}),
    };
    const run = isEdit
      ? update.mutateAsync(payload)
      : create.mutateAsync(payload);
    run
      .then(() =>
        toast.success(isEdit ? 'Restaurante actualizado.' : 'Restaurante creado.'),
      )
      .catch((error) =>
        toast.error(
          error instanceof ApiError ? error.message : 'No se pudo guardar.',
        ),
      );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TextField
        id="r-name"
        label="Nombre"
        required
        registration={register('name')}
        error={errors.name?.message}
      />
      <div className="space-y-1.5">
        <Label htmlFor="r-description">Descripción</Label>
        <Textarea
          id="r-description"
          rows={3}
          className="resize-none"
          {...register('description')}
        />
        {errors.description && (
          <p role="alert" className="text-xs font-medium text-danger">
            {errors.description.message}
          </p>
        )}
      </div>
      <TextField
        id="r-address"
        label="Dirección"
        required
        registration={register('address')}
        error={errors.address?.message}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="r-phone"
          label="Teléfono de contacto"
          required
          registration={register('contactPhone')}
          error={errors.contactPhone?.message}
        />
        <TextField
          id="r-email"
          label="Correo de contacto"
          type="email"
          required
          registration={register('contactEmail')}
          error={errors.contactEmail?.message}
        />
      </div>
      <TextField
        id="r-price"
        label="Precio mensual de la pensión (S/)"
        type="number"
        step="0.01"
        min="0.01"
        required
        registration={register('monthlyPensionPrice', { valueAsNumber: true })}
        error={errors.monthlyPensionPrice?.message}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="r-logo"
          label="URL del logo (opcional)"
          placeholder="https://…"
          registration={register('logoUrl')}
          error={errors.logoUrl?.message}
        />
        <TextField
          id="r-cover"
          label="URL de portada (opcional)"
          placeholder="https://…"
          registration={register('coverImageUrl')}
          error={errors.coverImageUrl?.message}
        />
      </div>
      <Button type="submit" loading={pending}>
        {isEdit ? 'Guardar cambios' : 'Crear restaurante'}
      </Button>
    </form>
  );
}
