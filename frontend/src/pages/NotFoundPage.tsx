import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada');
  return (
    <div className="container flex min-h-[60dvh] flex-col items-center justify-center py-16 text-center">
      <p className="text-6xl font-bold text-primary tabular-nums">404</p>
      <h1 className="mt-4 text-2xl font-bold text-text">Página no encontrada</h1>
      <p className="mt-2 max-w-md text-text-muted text-pretty">
        La página que buscas no existe o fue movida. Revisa la dirección o vuelve
        al inicio.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/">Ir al inicio</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/restaurantes">Ver restaurantes</Link>
        </Button>
      </div>
    </div>
  );
}
