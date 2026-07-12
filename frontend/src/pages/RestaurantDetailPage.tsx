import {
  ArrowLeft,
  ImageIcon,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CoverImage } from '@/components/shared/CoverImage';
import { ErrorState, StateMessage } from '@/components/shared/state-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuOfDay } from '@/features/menus/components/MenuOfDay';
import { useContractPension } from '@/features/pensions/hooks';
import { ScheduleList } from '@/features/restaurants/components/ScheduleList';
import { useRestaurant } from '@/features/restaurants/hooks';
import { getOpenState } from '@/features/restaurants/schedule';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError } from '@/lib/api-client';
import type { PublicRestaurantDetail } from '@/lib/api-types';
import { formatCurrency } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';

function DetailSkeleton() {
  return (
    <div className="container py-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 aspect-[21/9] w-full rounded-lg" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function DetailHero({ restaurant }: { restaurant: PublicRestaurantDetail }) {
  const { isOpen } = getOpenState(restaurant.schedules);
  return (
    <div className="relative overflow-hidden rounded-lg border border-border shadow-elevation-2">
      <CoverImage
        src={restaurant.coverImageUrl}
        alt={`Portada de ${restaurant.name}`}
        name={restaurant.name}
        aspectClassName="aspect-[2/1] sm:aspect-[21/9]"
        withGradient
        loading="eager"
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
        <div>
          <Badge variant={isOpen ? 'success' : 'neutral'} className="mb-3">
            <span
              className={`size-2 rounded-full ${isOpen ? 'bg-success' : 'bg-text-muted'}`}
              aria-hidden="true"
            />
            {isOpen ? 'Abierto ahora' : 'Cerrado ahora'}
          </Badge>
          <h1 className="text-2xl font-bold text-white sm:text-4xl text-balance">
            {restaurant.name}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {restaurant.address}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContractCard({ restaurant }: { restaurant: PublicRestaurantDetail }) {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const contract = useContractPension();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isNonClient = user != null && user.role !== 'CLIENT';

  const handleContract = () => {
    if (!user) {
      navigate(`/ingresar?redirect=/restaurantes/${restaurant.slug}`);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    contract.mutate(restaurant.id, {
      onSuccess: () => {
        toast.success(
          '¡Pensión contratada! Complétala desde tu panel para activarla.',
        );
        navigate('/app');
      },
      onError: (error) => {
        toast.error(
          error instanceof ApiError
            ? error.message
            : 'No se pudo contratar la pensión.',
        );
        setConfirmOpen(false);
      },
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-elevation-2 lg:sticky lg:top-24">
      <p className="text-sm text-text-muted">Pensión mensual</p>
      <p className="mt-1 text-3xl font-bold text-primary tabular-nums">
        {formatCurrency(restaurant.monthlyPensionPrice)}
        <span className="text-base font-medium text-text-muted"> / 30 días</span>
      </p>
      <p className="mt-3 text-sm text-text-muted text-pretty">
        Incluye tu menú del día durante 30 días. Reserva y confirma tu asistencia
        cada jornada.
      </p>

      {isNonClient ? (
        <p className="mt-5 rounded-md bg-surface-raised px-4 py-3 text-center text-sm text-text-muted">
          Ingresa con una cuenta de cliente para contratar.
        </p>
      ) : (
        <Button size="lg" className="mt-5 w-full" onClick={handleContract}>
          Contratar pensión
        </Button>
      )}
      <p className="mt-3 text-center text-xs text-text-muted">
        Los pagos y las facturas son simulados.
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Contratar pensión en ${restaurant.name}`}
        description={`Se creará una pensión de 30 días por ${formatCurrency(
          restaurant.monthlyPensionPrice,
        )}. Quedará pendiente de pago hasta que el restaurante registre tu pago.`}
        confirmLabel="Contratar"
        loading={contract.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function ContactBlock({ restaurant }: { restaurant: PublicRestaurantDetail }) {
  const mapsHref =
    restaurant.latitude != null && restaurant.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-text">Contacto y ubicación</h2>
      <ul className="space-y-2.5 text-sm">
        <li className="flex items-center gap-3">
          <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <a href={`tel:${restaurant.contactPhone}`} className="text-text hover:text-primary">
            {restaurant.contactPhone}
          </a>
        </li>
        <li className="flex items-center gap-3">
          <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <a
            href={`mailto:${restaurant.contactEmail}`}
            className="break-all text-text hover:text-primary"
          >
            {restaurant.contactEmail}
          </a>
        </li>
        <li className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-text">
            {restaurant.address}
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="ml-2 font-medium text-primary hover:underline"
            >
              Ver en el mapa
            </a>
          </span>
        </li>
      </ul>
    </div>
  );
}

function Gallery({ restaurant }: { restaurant: PublicRestaurantDetail }) {
  if (restaurant.images.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
        <ImageIcon className="size-5 text-primary" aria-hidden="true" />
        Galería
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {restaurant.images.map((image, i) => (
          <img
            key={image.id}
            src={image.url}
            alt={`${restaurant.name} — foto ${i + 1}`}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full rounded-md border border-border object-cover"
          />
        ))}
      </div>
    </div>
  );
}

export function RestaurantDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: restaurant, isLoading, isError, error, refetch } = useRestaurant(slug);

  useDocumentTitle(restaurant?.name);

  if (isLoading) return <DetailSkeleton />;

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="container py-16">
        {notFound ? (
          <StateMessage
            icon={MapPin}
            title="Restaurante no encontrado"
            description="Este restaurante no existe o ya no está disponible en el catálogo."
            action={
              <Button variant="secondary" asChild>
                <Link to="/restaurantes">Volver al catálogo</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="container py-8 lg:py-10">
      <Link
        to="/restaurantes"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Todos los restaurantes
      </Link>

      <div className="mt-4">
        <DetailHero restaurant={restaurant} />
      </div>

      <p className="mt-6 max-w-2xl text-text-muted text-pretty">
        {restaurant.description}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-12">
          <section aria-label="Menú del día">
            <MenuOfDay slug={restaurant.slug} />
          </section>
          <section aria-label="Horarios">
            <ScheduleList schedules={restaurant.schedules} />
          </section>
          <section aria-label="Galería">
            <Gallery restaurant={restaurant} />
          </section>
        </div>

        <aside className="space-y-10">
          <ContractCard restaurant={restaurant} />
          <ContactBlock restaurant={restaurant} />
        </aside>
      </div>
    </div>
  );
}
