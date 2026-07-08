import { ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { StateMessage } from '@/components/shared/state-message';
import { ErrorState } from '@/components/shared/state-message';
import { Button } from '@/components/ui/button';
import { RestaurantCard } from '@/features/restaurants/components/RestaurantCard';
import { RestaurantGridSkeleton } from '@/features/restaurants/components/RestaurantCardSkeleton';
import { useRestaurants } from '@/features/restaurants/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const PAGE_SIZE = 12;

export function CatalogPage() {
  useDocumentTitle('Restaurantes');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const { data, isLoading, isError, isPlaceholderData, refetch } = useRestaurants(
    page,
    PAGE_SIZE,
  );

  const goToPage = (next: number) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next <= 1) params.delete('page');
        else params.set('page', String(next));
        return params;
      },
      { replace: false },
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const restaurants = data?.items ?? [];
  const totalPages = data?.meta.totalPages ?? 1;
  const total = data?.meta.total ?? 0;

  return (
    <div className="container py-12 lg:py-16">
      <header className="mb-8">
        <h1 className="text-display font-bold text-text">Restaurantes</h1>
        <p className="mt-2 text-text-muted">
          {total > 0
            ? `${total} ${total === 1 ? 'restaurante disponible' : 'restaurantes disponibles'} para tu pensión mensual.`
            : 'Descubre restaurantes para contratar tu pensión mensual.'}
        </p>
      </header>

      {isLoading ? (
        <RestaurantGridSkeleton count={PAGE_SIZE} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : restaurants.length === 0 ? (
        <StateMessage
          icon={Store}
          title="Todavía no hay restaurantes"
          description="Aún no hay restaurantes aprobados en el catálogo. Vuelve pronto: estamos sumando nuevos locales."
        />
      ) : (
        <>
          <div
            className="grid grid-cols-1 gap-6 transition-opacity sm:grid-cols-2 lg:grid-cols-3"
            style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
          >
            {restaurants.map((restaurant, i) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                priority={i < 3}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-center gap-4"
              aria-label="Paginación de restaurantes"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isPlaceholderData}
              >
                <ChevronLeft aria-hidden="true" />
                Anterior
              </Button>
              <span className="text-sm text-text-muted tabular-nums" aria-current="page">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || isPlaceholderData}
              >
                Siguiente
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
