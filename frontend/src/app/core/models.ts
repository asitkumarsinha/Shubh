export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  phone?: string;
  address?: string;
  client_group?: 'retail' | 'wholesale';
}

export interface AdminUserDetail extends User {
  created_at?: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  password: string;
  passwordEncrypted: boolean;
  rank?: number;
  status: 'allowed' | 'blocked';
  client_group: 'retail' | 'wholesale';
  notes: string;
}

export interface AdminUsersResponse {
  users: AdminUserDetail[];
  topUsers: AdminUserDetail[];
  summary: {
    totalUsers: number;
    totalAdmins: number;
    usersWithOrders: number;
    blockedUsers: number;
    retailClients: number;
    wholesaleClients: number;
  };
}

export interface AdminClientDetail {
  client: AdminUserDetail;
  orders: Array<{
    id: number;
    bill_number: string;
    po_number: string | null;
    total: number;
    status: string;
    created_at: string;
  }>;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department?: string;
  address?: string;
  joining_date?: string;
  image: string | null;
  created_at?: string;
}

export interface DashboardPendingOrder {
  id: number;
  bill_number: string;
  total: number;
  created_at: string;
  status: string;
  userName: string;
  userEmail: string;
}

export interface DashboardLowStockItem {
  id: number;
  name: string;
  stock: number;
  price: number;
  image: string | null;
}

export interface Dashboard {
  summary: {
    todayOrders: number;
    pendingApprovals: number;
    revenue: number;
    revenueToday: number;
    lowStock: number;
    newClients: number;
    lowStockThreshold: number;
  };
  pendingOrders: DashboardPendingOrder[];
  lowStockItems: DashboardLowStockItem[];
}

export interface Medicine {
  id: number;
  name: string;
  description: string;
  price: number;
  wholesale_price?: number;
  listPrice?: number;
  unitPrice?: number;
  image: string | null;
  stock: number;
  created_at?: string;
}

export interface CartItem {
  medicineId: number;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stock: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  medicine_id: number;
  medicine_name: string;
  medicine_image: string | null;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  user_id: number;
  bill_number: string;
  po_number: string | null;
  total: number;
  status: 'pending' | 'approved' | 'cancelled' | 'rejected' | 'dispatched';
  qr_code: string;
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
  user?: User;
}

export interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  pending: number;
  approved: number;
  cancelled: number;
  rejected: number;
  dispatched: number;
  uniqueBuyers: number;
}

export interface Report {
  summary: ReportSummary;
  buyers: Array<{
    id: number;
    name: string;
    email: string;
    phone: string;
    address: string;
    orderCount: number;
    totalSpent: number;
  }>;
  orders: Array<{
    id: number;
    bill_number: string;
    po_number: string | null;
    total: number;
    status: string;
    created_at: string;
    userName: string;
    userEmail: string;
    userPhone: string;
  }>;
  topMedicines: Array<{
    medicine_name: string;
    qtySold: number;
    revenue: number;
  }>;
}
