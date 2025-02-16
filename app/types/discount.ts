export interface DiscountRule {
    id: string;
    shop: string;
    name: string;
    description?: string;
    type: 'percentage' | 'fixed_amount';
    value: number;
    startDate: Date;
    endDate?: Date;
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
    vendor?: string;
    originalPrice: number;
    currentPrice: number;
    comparePrice?: number;
    ruleId?: string;
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