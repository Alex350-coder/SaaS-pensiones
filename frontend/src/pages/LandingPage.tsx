import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  MessageCircle,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RestaurantCard } from '@/features/restaurants/components/RestaurantCard';
import { RestaurantGridSkeleton } from '@/features/restaurants/components/RestaurantCardSkeleton';
import { useRestaurants } from '@/features/restaurants/hooks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    icon: Store,
    title: 'Elige tu restaurante',
    body: 'Explora el catálogo, revisa el menú del día, los horarios y la ubicación.',
  },
  {
    icon: CreditCard,
    title: 'Contrata tu pensión',
    body: 'Un plan de 30 días con precio fijo. Sin sorpresas al final del mes.',
  },
  {
    icon: CalendarCheck,
    title: 'Reserva y confirma',
    body: 'Reserva tu menú diario, confirma tu asistencia y coordina por chat.',
  },
] as const;

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(60% 60% at 15% 0%, var(--color-primary-soft) 0%, transparent 60%), radial-gradient(50% 50% at 100% 20%, var(--color-secondary-soft) 0%, transparent 55%)',
        }}
      />
      <div className="container grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-text-muted shadow-elevation-1">
            <UtensilsCrossed className="size-4 text-primary" aria-hidden="true" />
            Comidas caseras, todos los días
          </span>
          <h1 className="mt-5 text-hero font-extrabold text-text text-balance">
            Tu pensión mensual,{' '}
            <span className="text-primary">sin complicaciones</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-text-muted text-pretty">
            Contrata un plan de comidas de 30 días con restaurantes de confianza.
            Reserva tu menú del día, confirma tu asistencia y paga un precio fijo
            al mes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/restaurantes">
                Explorar restaurantes
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/registro">Crear cuenta gratis</Link>
            </Button>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/** Decorative, layered "menu card" preview — depth without a real photo. */
function HeroVisual() {
  return (
    <div className="relative hidden lg:block" aria-hidden="true">
      <div className="absolute -right-6 top-8 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      <div className="relative mx-auto max-w-sm rounded-xl border border-border bg-surface p-6 shadow-elevation-4 animate-fade-up [animation-delay:120ms]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text">Menú de hoy</span>
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
            Publicado
          </span>
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          {[
            ['Entrada', 'Papa a la huancaína'],
            ['Principal', 'Lomo saltado'],
            ['Bebida', 'Chicha morada'],
            ['Postre', 'Mazamorra morada'],
          ].map(([course, dish]) => (
            <li key={course} className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {course}
              </span>
              <span className="font-medium text-text">{dish}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between rounded-md bg-surface-raised px-4 py-3">
          <span className="text-sm text-text-muted">Pensión mensual</span>
          <span className="text-lg font-bold text-primary tabular-nums">S/ 742.00</span>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-t border-border bg-surface">
      <div className="container py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-display font-bold text-text text-balance">
            Cómo funciona
          </h2>
          <p className="mt-3 text-text-muted text-pretty">
            De elegir restaurante a comer a diario en tres pasos simples.
          </p>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative rounded-lg border border-border bg-background p-6 shadow-elevation-1"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevation-2">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="absolute right-6 top-6 text-4xl font-bold text-border tabular-nums">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-text">{step.title}</h3>
                <p className="mt-1.5 text-sm text-text-muted text-pretty">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function FeaturedRestaurants() {
  const { data, isLoading, isError } = useRestaurants(1, 3);
  const restaurants = data?.items ?? [];

  if (isError || (!isLoading && restaurants.length === 0)) return null;

  return (
    <section className="container py-16 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-display font-bold text-text">Restaurantes destacados</h2>
          <p className="mt-2 text-text-muted">Comienza a explorar la oferta disponible.</p>
        </div>
        <Button variant="ghost" asChild>
          <Link to="/restaurantes">
            Ver todos
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <RestaurantGridSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((restaurant, i) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                priority={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="container pb-20">
      <div className="relative overflow-hidden rounded-xl bg-ink px-6 py-12 text-center shadow-elevation-3 sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(50% 80% at 100% 0%, var(--color-primary) 0%, transparent 60%), radial-gradient(50% 80% at 0% 100%, var(--color-secondary) 0%, transparent 55%)',
          }}
        />
        <div className="relative">
          <MessageCircle className="mx-auto size-8 text-accent" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl text-balance">
            Empieza a comer mejor este mes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80 text-pretty">
            Crea tu cuenta gratis y contrata tu primera pensión en minutos.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/registro">Crear cuenta</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link to="/restaurantes">Ver restaurantes</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  useDocumentTitle();
  return (
    <>
      <Hero />
      <HowItWorks />
      <FeaturedRestaurants />
      <CtaBand />
    </>
  );
}
