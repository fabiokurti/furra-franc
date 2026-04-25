export type Role = 'ADMIN' | 'STAFF';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'BAKING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  productId: string;
  product: Pick<Product, 'id' | 'name'>;
}

export interface Order {
  id: string;
  orderNo: string;
  status: OrderStatus;
  isPaid: boolean;
  totalPrice: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  createdBy: Pick<User, 'id' | 'name' | 'email'>;
  items: OrderItem[];
}

export type DeliveryStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface ClientProductPrice {
  id: string;
  price: number;
  productId: string;
  product: Pick<Product, 'id' | 'name' | 'category'>;
}

export interface Client {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
  isActive: boolean;
  staffId: string;
  assignedTo: Pick<User, 'id' | 'name' | 'email'>;
  prices?: ClientProductPrice[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryItem {
  id: string;
  quantity: number;
  productId: string;
  product: Pick<Product, 'id' | 'name' | 'category'>;
}

export interface Delivery {
  id: string;
  status: DeliveryStatus;
  isPaid: boolean;
  notes?: string;
  deliveryDate: string;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  client: Pick<Client, 'id' | 'name' | 'address' | 'phone'>;
  staffId: string;
  createdBy: Pick<User, 'id' | 'name'>;
  items: DeliveryItem[];
}

export interface DashboardDelivery extends Delivery {
  totalPrice: number;
}

export type DailyStockStatus = 'OPEN' | 'CLOSED';

export interface DailyStockItem {
  id: string;
  productId: string;
  quantity: number;
  delivered: number;
  remaining: number;
  product: Pick<Product, 'id' | 'name' | 'category'>;
}

export interface DailyStock {
  id: string;
  date: string;
  status: DailyStockStatus;
  items: DailyStockItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  recentOrders: Order[];
  completedDeliveries: DashboardDelivery[];
}
