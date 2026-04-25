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
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/orders', element: <OrdersPage /> },
          { path: '/clients', element: <ClientsPage /> },
          { path: '/deliveries', element: <DeliveriesPage /> },
          { path: '/deliveries/:id', element: <DeliveryDetailPage /> },
          { path: '/staff', element: <StaffPage /> },
          { path: '/daily-stock', element: <DailyStockPage /> },
        ],
      },
    ],
  },
]);
