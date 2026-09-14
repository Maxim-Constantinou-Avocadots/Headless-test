import { productsV3, readOnlyVariantsV3 } from '@wix/stores';
import { categories } from '@wix/categories';
import { imageUrl } from './media';

/**
 * Requested on every product read. Without CURRENCY there is no
 * formattedAmount (prices render as bare numbers); without
 * PLAIN_DESCRIPTION there is no plain string for cards.
 * One constant so no page can drift from another.
 */
const PRODUCT_FIELDS = ['CURRENCY', 'PLAIN_DESCRIPTION'] as const;
const productFields = () => [...PRODUCT_FIELDS];

export interface Product {
  _id: string;
  slug: string;
  name: string;
  price: string;
  compareAt: string;
  description: string;
  image: string;
  inStock: boolean;
}

export interface Variant {
  variantId: string;
  choices: Record<string, string>;
  inStock: boolean;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
}

function toProduct(p: Record<string, any>): Product {
  const actual = p.actualPriceRange?.minValue;
  const compare = p.compareAtPriceRange?.minValue;
  return {
    _id: p._id,
    slug: p.slug ?? '',
    name: p.name ?? '',
    // formattedAmount is already localised; the raw amount is only a fallback.
    price: actual?.formattedAmount ?? (actual?.amount ? `£${actual.amount}` : ''),
    compareAt: compare?.formattedAmount ?? '',
    description: p.plainDescription ?? '',
    image: imageUrl(p.media?.main?.image ?? p.media?.main?.url ?? '', 800, 800),
    inStock: p.inventory?.availabilityStatus !== 'OUT_OF_STOCK',
  };
}

/** All visible products. Never throws — an empty list drives the error state. */
export async function getProducts(): Promise<{ products: Product[]; failed: boolean }> {
  try {
    const res = await productsV3.queryProducts({ fields: productFields() }).limit(100).find();
    return { products: (res.items ?? []).map(toProduct), failed: false };
  } catch (err) {
    console.error('[store] product query failed', err);
    return { products: [], failed: true };
  }
}

/**
 * Products in one category. Category filtering must go through
 * searchProducts with $matchItems — the field is not filterable on
 * queryProducts, which fails with a silently-swallowed 400 and an
 * empty-looking category.
 */
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  try {
    const res = await productsV3.searchProducts(
      { filter: { 'directCategoriesInfo.categories': { $matchItems: [{ id: categoryId }] } } },
      { fields: productFields() },
    );
    return (res.products ?? []).map(toProduct);
  } catch (err) {
    console.error('[store] category search failed', err);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const res = await productsV3.queryProducts({ fields: productFields() }).eq('slug', slug).limit(1).find();
    const row = (res.items ?? [])[0];
    return row ? toProduct(row) : null;
  } catch (err) {
    console.error('[store] product slug lookup failed', err);
    return null;
  }
}

/**
 * Variants are a separate read-only resource — queryProducts returns
 * variantsInfo: null, so they must be fetched on their own.
 */
export async function getVariants(productId: string): Promise<Variant[]> {
  try {
    const res = await readOnlyVariantsV3.queryVariants()
      .eq('productData.productId', productId).find();
    return (res.items ?? []).map((v: Record<string, any>) => {
      const choices: Record<string, string> = {};
      for (const c of v.optionChoices ?? []) {
        const n = c.optionChoiceNames;
        if (n?.optionName) choices[n.optionName] = n.choiceName;
      }
      return {
        variantId: v.variantId ?? v._id,
        choices,
        inStock: v.inventoryStatus?.inStock !== false,
      };
    });
  } catch (err) {
    console.error('[store] variant query failed', err);
    return [];
  }
}

/**
 * Live category list for the shop filter bar. A category the owner adds in
 * the dashboard appears here with no code change.
 * The query must carry a filter condition — a bare .find() serialises an
 * empty filter that the categories API rejects.
 */
export async function getCategories(): Promise<Category[]> {
  try {
    const res = await categories
      .queryCategories({ treeReference: { appNamespace: '@wix/stores' } })
      .exists('name', true)
      .find();
    return (res.items ?? []).map((c: Record<string, any>) => ({
      _id: c._id, name: c.name ?? '', slug: c.slug ?? '',
    }));
  } catch (err) {
    console.error('[store] category query failed', err);
    return [];
  }
}
