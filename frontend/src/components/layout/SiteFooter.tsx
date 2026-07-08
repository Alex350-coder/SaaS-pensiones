import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-text-muted text-pretty">
            Tu plan de comidas mensual con restaurantes de confianza: menú del
            día, reservas y asistencia en un solo lugar.
          </p>
        </div>

        <nav aria-label="Explorar" className="space-y-3 text-sm">
          <p className="font-semibold text-text">Explorar</p>
          <ul className="space-y-2 text-text-muted">
            <li>
              <Link to="/restaurantes" className="hover:text-text">
                Restaurantes
              </Link>
            </li>
            <li>
              <Link to="/#como-funciona" className="hover:text-text">
                Cómo funciona
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Cuenta" className="space-y-3 text-sm">
          <p className="font-semibold text-text">Cuenta</p>
          <ul className="space-y-2 text-text-muted">
            <li>
              <Link to="/ingresar" className="hover:text-text">
                Ingresar
              </Link>
            </li>
            <li>
              <Link to="/registro" className="hover:text-text">
                Crear cuenta
              </Link>
            </li>
          </ul>
        </nav>

        <div className="space-y-3 text-sm">
          <p className="font-semibold text-text">Proyecto</p>
          <p className="text-text-muted text-pretty">
            Proyecto de portafolio. Los pagos y las facturas son simulados.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-2 py-6 text-xs text-text-muted sm:flex-row">
          <p>© {year} Pensiones. Todos los derechos reservados.</p>
          <p>Hecho con cuidado en Perú.</p>
        </div>
      </div>
    </footer>
  );
}
