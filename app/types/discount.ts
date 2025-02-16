export interface DiscountRule {
  id: string;
  shop: string;
  name: string;
  description?: string | null;
  type: 'percentage' | 'fixed_amount';
  value: number;
  startDate: Date;
  endDate?: Date | null;
  isActive: boolean;
  filters: Filter[];
  products: Product[];
}

export interface Filter {
  id: string;
  ruleId: string;
  type: 'category' | 'vendor' | 'tag' | 'product';
  value: string;
}

export interface Product {
  id: string;
  shop: string;
  title: string;
  vendor?: string | null;
  originalPrice: number;
  currentPrice: number;
  comparePrice?: number | null;
  ruleId?: string | null;
}

export interface PriceHistory {
  id: string;
  productId: string;
  ruleId: string;
  oldPrice: number;
  newPrice: number;
  createdAt: Date;
  createdBy: string;
  product: Product;
  rule: DiscountRule;
}

export interface DiscountView {
  id: string;
  name: string;
  description?: string | null;
  type: 'percentage' | 'fixed_amount';
  value: number;
  startDate: Date;
  endDate?: Date | null;
  isActive: boolean;
  productCount: number;
  totalDiscount: number;
}