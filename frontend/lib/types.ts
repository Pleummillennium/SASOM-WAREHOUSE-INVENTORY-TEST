export interface ShelfSummary {
  shelfCode: string;
  category: string;
  minBoxHeight: number | null;
  maxBoxHeight: number | null;
  slotHeight: number;
  totalLevels: number;
  totalSlots: number;
  ordersAllocated: number;
  slotsUsed: number;
  totalSlotCapacity: number;
  usagePercent: number;
}

export interface SlotItem {
  orderId: string;
  productName: string;
  boxHeight: number;
  price: number;
}

export interface ShelfDetail {
  shelfCode: string;
  category: string;
  slotHeight: number;
  totalLevels: number;
  totalSlots: number;
  allocated: number;
  grid: Record<number, Record<number, SlotItem[]>>;
}

export interface OrderLocation {
  orderId: string;
  productName: string;
  category: string;
  boxHeight: number;
  price: number;
  location: {
    shelfCode: string;
    level: number;
    slot: number;
  };
}

export interface AllocationStats {
  totalOrders: number;
  allocated: number;
  skipped: number;
  byCategory: { category: string; total: number; allocated: number; skipped: number }[];
  skippedOrders: { orderId: string; category: string; boxHeight: number; productName: string }[];
}

export interface RunAllocationResult {
  allocated: number;
  skipped: number;
  skippedOrders: string[];
}

export interface SlotSearch {
  location: { shelfCode: string; level: number; slot: number };
  count: number;
  orders: SlotItem[];
}
