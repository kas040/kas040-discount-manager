import prisma from '../db.server';
import type { DiscountRule, Filter, Product, DiscountView } from '../types/discount';
import { authenticate } from '../shopify.server';

export async function createDiscountRule(
  request: Request,
  data: Omit<DiscountRule, 'id' | 'shop' | 'products'>
): Promise<DiscountRule> {
  const { admin, session } = await authenticate.admin(request);
  
  const rule = await prisma.discountRule.create({
    data: {
      ...data,
      shop: session.shop,
      filters: {
        create: data.filters,
      },
    },
    include: {
      filters: true,
      products: true,
    },
  }) as DiscountRule;

  // Apply the rule to matching products
  await applyDiscountRule(request, rule.id);

  return rule;
}

export async function applyDiscountRule(request: Request, ruleId: string): Promise<void> {
  const { admin, session } = await authenticate.admin(request);
  const rule = await prisma.discountRule.findUnique({
    where: { id: ruleId },
    include: { filters: true, products: true },
  }) as (DiscountRule & { filters: Filter[] }) | null;

  if (!rule || !rule.isActive) return;

  // Build GraphQL query based on filters
  const filterConditions = buildFilterConditions(rule.filters);
  
  const response = await admin.graphql(`
    query getProducts($query: String!) {
      products(first: 250, query: $query) {
        edges {
          node {
            id
            title
            vendor
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  compareAtPrice
                }
              }
            }
          }
        }
      }
    }
  `, {
    variables: {
      query: filterConditions,
    },
  });

  const { data } = await response.json();
  
  // Update products with new prices
  for (const edge of data.products.edges) {
    const product = edge.node;
    const variant = product.variants.edges[0].node;
    const originalPrice = parseFloat(variant.price);
    const newPrice = calculateDiscountedPrice(originalPrice, rule);

    // Update product in Shopify
    await admin.graphql(`
      mutation productVariantUpdate($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant {
            id
            price
            compareAtPrice
          }
        }
      }
    `, {
      variables: {
        input: {
          id: variant.id,
          price: newPrice.toString(),
          compareAtPrice: originalPrice.toString(),
        },
      },
    });

    // Store in our database
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        currentPrice: newPrice,
        comparePrice: originalPrice,
        ruleId: rule.id,
      },
      create: {
        id: product.id,
        shop: session.shop,
        title: product.title,
        vendor: product.vendor,
        originalPrice,
        currentPrice: newPrice,
        comparePrice: originalPrice,
        ruleId: rule.id,
      },
    });

    // Record in history
    await prisma.history.create({
      data: {
        productId: product.id,
        ruleId: rule.id,
        oldPrice: originalPrice,
        newPrice,
        createdBy: session.id,
      },
    });
  }
}

export async function getDiscountViews(request: Request): Promise<DiscountView[]> {
  const { session } = await authenticate.admin(request);

  const rules = await prisma.discountRule.findMany({
    where: { shop: session.shop },
    include: {
      products: true,
    },
  });

  return rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    type: rule.type as 'percentage' | 'fixed_amount',
    value: rule.value,
    startDate: rule.startDate,
    endDate: rule.endDate,
    isActive: rule.isActive,
    productCount: rule.products.length,
    totalDiscount: rule.products.reduce((total, product) => {
      const discount = rule.type === 'percentage'
        ? product.originalPrice * (rule.value / 100)
        : rule.value;
      return total + discount;
    }, 0),
  }));
}

function buildFilterConditions(filters: Filter[]): string {
  return filters
    .map((filter) => {
      switch (filter.type) {
        case 'vendor':
          return `vendor:'${filter.value}'`;
        case 'tag':
          return `tag:'${filter.value}'`;
        case 'product':
          return `id:'${filter.value}'`;
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join(' AND ');
}

function calculateDiscountedPrice(originalPrice: number, rule: DiscountRule): number {
  if (rule.type === 'percentage') {
    return originalPrice * (1 - rule.value / 100);
  }
  return Math.max(0, originalPrice - rule.value);
}