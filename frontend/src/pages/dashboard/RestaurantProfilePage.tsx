import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeading } from '@/components/shared/page-heading';
import { ErrorState } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RestaurantForm } from '@/features/restaurant-profile/components/RestaurantForm';
import {
  isNoRestaurant,
  useAddImage,
  useOwnRestaurant,
  useRemoveImage,
  useReplaceSchedules,
} from '@/features/restaurant-profile/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import type { ImageView, ScheduleView } from '@/lib/api-types';
import { dayName } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DayRow {
  dayOfWeek: number;
  open: boolean;
  opensAt: string;
  closesAt: string;
}

function initialDays(schedules: ScheduleView[]): DayRow[] {
  return Array.from({ length: 7 }, (_, dow) => {
    const found = schedules.find((s) => s.dayOfWeek === dow);
    return {
      dayOfWeek: dow,
      open: Boolean(found),
      opensAt: found?.opensAt ?? '12:00',
      closesAt: found?.closesAt ?? '22:00',
    };
  });
}

function SchedulesEditor({ schedules }: { schedules: ScheduleView[] }) {
  const [days, setDays] = useState<DayRow[]>(() => initialDays(schedules));
  const replace = useReplaceSchedules();

  const update = (dow: number, patch: Partial<DayRow>) =>
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)),
    );

  const save = () => {
    const payload: ScheduleView[] = days
      .filter((d) => d.open)
      .map((d) => ({
        dayOfWeek: d.dayOfWeek,
        opensAt: d.opensAt,
        closesAt: d.closesAt,
      }));
    replace.mutate(payload, {
      onSuccess: () => toast.success('Horarios actualizados.'),
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : 'No se pudieron guardar.',
        ),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Horarios de atención</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {days.map((d) => (
          <div key={d.dayOfWeek} className="flex flex-wrap items-center gap-3">
            <label className="flex w-32 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border text-primary"
                checked={d.open}
                onChange={(e) => update(d.dayOfWeek, { open: e.target.checked })}
              />
              <span className="capitalize">{dayName(d.dayOfWeek)}</span>
            </label>
            <Input
              type="time"
              className="w-32"
              disabled={!d.open}
              value={d.opensAt}
              onChange={(e) => update(d.dayOfWeek, { opensAt: e.target.value })}
            />
            <span className="text-text-muted">–</span>
            <Input
              type="time"
              className="w-32"
              disabled={!d.open}
              value={d.closesAt}
              onChange={(e) => update(d.dayOfWeek, { closesAt: e.target.value })}
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          loading={replace.isPending}
          onClick={save}
        >
          Guardar horarios
        </Button>
      </CardContent>
    </Card>
  );
}

function GalleryManager({ images }: { images: ImageView[] }) {
  const [url, setUrl] = useState('');
  const add = useAddImage();
  const remove = useRemoveImage();

  const handleAdd = () => {
    if (!url.trim()) return;
    add.mutate(url.trim(), {
      onSuccess: () => {
        toast.success('Imagen añadida.');
        setUrl('');
      },
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.message : 'No se pudo añadir.',
        ),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Galería ({images.length}/12)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="https://… URL de la imagen"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            variant="secondary"
            loading={add.isPending}
            disabled={images.length >= 12 || !url.trim()}
            onClick={handleAdd}
          >
            <Plus aria-hidden="true" />
            Añadir
          </Button>
        </div>
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, i) => (
              <div
                key={image.id}
                className="group relative overflow-hidden rounded-md border border-border"
              >
                <img
                  src={image.url}
                  alt={`Foto de la galería ${i + 1}`}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  aria-label="Eliminar imagen"
                  onClick={() =>
                    remove.mutate(image.id, {
                      onSuccess: () => toast.success('Imagen eliminada.'),
                      onError: () => toast.error('No se pudo eliminar.'),
                    })
                  }
                  className={cn(
                    'absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white',
                    'opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100',
                  )}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RestaurantProfilePage() {
  useDocumentTitle('Mi restaurante');
  const own = useOwnRestaurant();

  return (
    <>
      <PageHeading
        title="Mi restaurante"
        description="Gestiona el perfil, los horarios y la galería de tu restaurante."
      />

      {own.isLoading && <Skeleton className="h-96 w-full rounded-lg" />}

      {own.isError && isNoRestaurant(own.error) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registra tu restaurante</CardTitle>
          </CardHeader>
          <CardContent>
            <RestaurantForm />
          </CardContent>
        </Card>
      )}

      {own.isError && !isNoRestaurant(own.error) && (
        <ErrorState onRetry={() => own.refetch()} />
      )}

      {own.data && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <RestaurantForm restaurant={own.data} />
            </CardContent>
          </Card>
          <SchedulesEditor key={own.data.id} schedules={own.data.schedules} />
          <GalleryManager images={own.data.images} />
        </div>
      )}
    </>
  );
}
