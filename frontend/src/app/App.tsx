import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RequireAuth } from '@/components/routing/RequireAuth';
import { RequireRole } from '@/components/routing/RequireRole';
import { Spinner } from '@/components/ui/spinner';

// The private shell (and its socket.io / Radix deps) is lazy so it never ships
// in the public/landing bundle — only loaded when entering an authed area.
const AppLayout = lazy(() =>
  import('@/components/layout/AppLayout').then((m) => ({ default: m.AppLayout })),
);

// Route-level code splitting keeps the landing bundle within budget; each
// surface loads its own chunk on demand.
const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const CatalogPage = lazy(() =>
  import('@/pages/CatalogPage').then((m) => ({ default: m.CatalogPage })),
);
const RestaurantDetailPage = lazy(() =>
  import('@/pages/RestaurantDetailPage').then((m) => ({
    default: m.RestaurantDetailPage,
  })),
);
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

// Private surfaces — each is a role-gated area under the shared AppLayout shell.
const ClientHomePage = lazy(() =>
  import('@/pages/app/ClientHomePage').then((m) => ({
    default: m.ClientHomePage,
  })),
);
const RestaurantHomePage = lazy(() =>
  import('@/pages/dashboard/RestaurantHomePage').then((m) => ({
    default: m.RestaurantHomePage,
  })),
);
const AdminHomePage = lazy(() =>
  import('@/pages/admin/AdminHomePage').then((m) => ({
    default: m.AdminHomePage,
  })),
);
const MessagesPage = lazy(() =>
  import('@/pages/shared/MessagesPage').then((m) => ({
    default: m.MessagesPage,
  })),
);
const ReservationsPage = lazy(() =>
  import('@/pages/app/ReservationsPage').then((m) => ({
    default: m.ReservationsPage,
  })),
);
const AttendancePage = lazy(() =>
  import('@/pages/app/AttendancePage').then((m) => ({
    default: m.AttendancePage,
  })),
);
const ClientInvoicesPage = lazy(() =>
  import('@/pages/app/ClientInvoicesPage').then((m) => ({
    default: m.ClientInvoicesPage,
  })),
);
const PensionersPage = lazy(() =>
  import('@/pages/dashboard/PensionersPage').then((m) => ({
    default: m.PensionersPage,
  })),
);
const MenusPage = lazy(() =>
  import('@/pages/dashboard/MenusPage').then((m) => ({ default: m.MenusPage })),
);
const DishesPage = lazy(() =>
  import('@/pages/dashboard/DishesPage').then((m) => ({ default: m.DishesPage })),
);
const ReservationsAdminPage = lazy(() =>
  import('@/pages/dashboard/ReservationsAdminPage').then((m) => ({
    default: m.ReservationsAdminPage,
  })),
);
const NoticesPage = lazy(() =>
  import('@/pages/dashboard/NoticesPage').then((m) => ({ default: m.NoticesPage })),
);
const RestaurantInvoicesPage = lazy(() =>
  import('@/pages/dashboard/RestaurantInvoicesPage').then((m) => ({
    default: m.RestaurantInvoicesPage,
  })),
);
const RestaurantProfilePage = lazy(() =>
  import('@/pages/dashboard/RestaurantProfilePage').then((m) => ({
    default: m.RestaurantProfilePage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('@/pages/admin/AdminUsersPage').then((m) => ({
    default: m.AdminUsersPage,
  })),
);
const AdminAuditPage = lazy(() =>
  import('@/pages/admin/AdminAuditPage').then((m) => ({
    default: m.AdminAuditPage,
  })),
);

function PageFallback() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Spinner label="Cargando página…" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/restaurantes" element={<CatalogPage />} />
            <Route path="/restaurantes/:slug" element={<RestaurantDetailPage />} />
            <Route path="/ingresar" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Private, role-gated surfaces (Fase 13). */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole allow={['CLIENT']} />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<ClientHomePage />} />
                <Route path="reservas" element={<ReservationsPage />} />
                <Route path="asistencia" element={<AttendancePage />} />
                <Route path="mensajes" element={<MessagesPage />} />
                <Route path="facturas" element={<ClientInvoicesPage />} />
              </Route>
            </Route>
            <Route element={<RequireRole allow={['RESTAURANT_ADMIN']} />}>
              <Route path="/panel" element={<AppLayout />}>
                <Route index element={<RestaurantHomePage />} />
                <Route path="pensionarios" element={<PensionersPage />} />
                <Route path="menus" element={<MenusPage />} />
                <Route path="platos" element={<DishesPage />} />
                <Route path="reservas" element={<ReservationsAdminPage />} />
                <Route path="avisos" element={<NoticesPage />} />
                <Route path="mensajes" element={<MessagesPage />} />
                <Route path="facturas" element={<RestaurantInvoicesPage />} />
                <Route path="restaurante" element={<RestaurantProfilePage />} />
              </Route>
            </Route>
            <Route element={<RequireRole allow={['SUPER_ADMIN']} />}>
              <Route path="/admin" element={<AppLayout />}>
                <Route index element={<AdminHomePage />} />
                <Route path="usuarios" element={<AdminUsersPage />} />
                <Route path="auditoria" element={<AdminAuditPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
