import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { DeliveriesPage } from '@/pages/DeliveriesPage';
import { DeliveryDetailPage } from '@/pages/DeliveryDetailPage';
import { StaffPage } from '@/pages/StaffPage';
import { DailyStockPage } from '@/pages/DailyStockPage';
import { ShopPage } from '@/pages/ShopPage';
import { BusinessSalesPage } from '@/pages/BusinessSalesPage';
import { useAuth } from '@/context/AuthContext';

function RoleRedirect() {
  const { user } = useAuth();
  const to = user?.role === 'BUSINESS' ? '/shop' : user?.role === 'STAFF' ? '/deliveries' : '/dashboard';
  return <Navigate to={to} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <RoleRedirect /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/orders', element: <OrdersPage /> },
          { path: '/clients', element: <ClientsPage /> },
          { path: '/deliveries', element: <DeliveriesPage /> },
          { path: '/deliveries/:id', element: <DeliveryDetailPage /> },
          { path: '/staff', element: <StaffPage /> },
          { path: '/daily-stock', element: <DailyStockPage /> },
          { path: '/shop', element: <ShopPage /> },
          { path: '/business-sales', element: <BusinessSalesPage /> },
        ],
      },
    ],
  },
]);
