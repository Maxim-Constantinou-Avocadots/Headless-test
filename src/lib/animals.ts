import { items } from '@wix/data';
import { ageBracket, type AgeBracket } from './format';

export const ANIMALS_COLLECTION = 'Animals';

export interface Animal {
  _id: string;
  name: string;
  slug: string;
  species: string;
  breed: string;
  age: number | null;
  sex: string;
  size: string;
  mainImage?: unknown;
  gallery?: unknown;
  shortDescription: string;
  description?: string;
  goodWithKids: boolean;
  goodWithDogs: boolean;
  goodWithCats: boolean;
  houseTrained: boolean;
  neutered: boolean;
  vaccinated: boolean;
  specialNeeds?: string;
  adoptionFee: number | null;
  status: string;
  intakeDate?: string;
  featured: boolean;
  bondedWith?: string | Animal | null;
}

function toAnimal(row: Record<string, any>): Animal {
  return {
    _id: row._id,
    name: row.name ?? '',
    slug: row.slug ?? '',
    species: row.species ?? '',
    breed: row.breed ?? '',
    age: typeof row.age === 'number' ? row.age : null,
    sex: row.sex ?? '',
    size: row.size ?? '',
    mainImage: row.mainImage,
    gallery: row.gallery,
    shortDescription: row.shortDescription ?? '',
    description: row.description ?? '',
    goodWithKids: !!row.goodWithKids,
    goodWithDogs: !!row.goodWithDogs,
    goodWithCats: !!row.goodWithCats,
    houseTrained: !!row.houseTrained,
    neutered: !!row.neutered,
    vaccinated: !!row.vaccinated,
    specialNeeds: row.specialNeeds ?? '',
    adoptionFee: typeof row.adoptionFee === 'number' ? row.adoptionFee : null,
    status: row.status ?? 'Available',
    intakeDate: row.intakeDate,
    featured: !!row.featured,
    bondedWith: row.bondedWith ?? null,
  };
}

/**
 * Every animal, newest intake first. The collection is small (a shelter holds
 * tens, not thousands), so one query per request keeps filtering, sorting and
 * counting consistent — and the Adopt page needs the whole set anyway to build
 * accurate filter counts and the "happy endings" section.
 *
 * Never throws: a failed read returns an empty list so the page can render its
 * error state instead of white-screening (astro.md caveat A3).
 */
export async function getAllAnimals(): Promise<{ animals: Animal[]; failed: boolean }> {
  try {
    const res = await items.query(ANIMALS_COLLECTION).descending('intakeDate').limit(200).find();
    return { animals: (res.items ?? []).map(toAnimal), failed: false };
  } catch (err) {
    console.error('[animals] query failed', err);
    return { animals: [], failed: true };
  }
}

/** One animal by its URL slug. Returns null when not found. */
export async function getAnimalBySlug(slug: string): Promise<Animal | null> {
  try {
    const res = await items.query(ANIMALS_COLLECTION).eq('slug', slug).limit(1).find();
    const row = (res.items ?? [])[0];
    return row ? toAnimal(row) : null;
  } catch (err) {
    console.error('[animals] slug lookup failed', err);
    return null;
  }
}

export async function getAnimalById(id: string): Promise<Animal | null> {
  try {
    const res = await items.query(ANIMALS_COLLECTION).eq('_id', id).limit(1).find();
    const row = (res.items ?? [])[0];
    return row ? toAnimal(row) : null;
  } catch {
    return null;
  }
}

/**
 * Featured animals for the home page row. Driven by a live query on the
 * `featured` flag, so the owner controls the row from the dashboard.
 * Falls back to the newest available animals if nothing is flagged, so the
 * home page is never empty.
 */
export async function getFeaturedAnimals(limit = 4): Promise<Animal[]> {
  const { animals } = await getAllAnimals();
  const available = animals.filter((a) => a.status === 'Available');
  const featured = available.filter((a) => a.featured);
  return (featured.length ? featured : available).slice(0, limit);
}

/** Animals an applicant may currently apply for. */
export function applicableAnimals(animals: Animal[]): Animal[] {
  return animals
    .filter((a) => a.status === 'Available' || a.status === 'Pending')
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Filtering — shared by the server render and the client island so a  */
/* filtered URL renders identically before and after hydration.        */
/* ------------------------------------------------------------------ */

export interface AnimalFilters {
  species: string[];
  size: string[];
  age: AgeBracket[];
  sex: string[];
  goodWith: string[];        // 'kids' | 'dogs' | 'cats'
  search: string;
  includePending: boolean;
  sort: 'newest' | 'name' | 'age';
}

export const EMPTY_FILTERS: AnimalFilters = {
  species: [], size: [], age: [], sex: [], goodWith: [],
  search: '', includePending: false, sort: 'newest',
};

/** Read filters out of a URL query string so a filtered view is shareable. */
export function filtersFromParams(params: URLSearchParams): AnimalFilters {
  const list = (k: string) => (params.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const sort = params.get('sort');
  return {
    species: list('species'),
    size: list('size'),
    age: list('age') as AgeBracket[],
    sex: list('sex'),
    goodWith: list('with'),
    search: (params.get('q') ?? '').trim(),
    includePending: params.get('pending') === '1',
    sort: sort === 'name' || sort === 'age' ? sort : 'newest',
  };
}

/** Inverse of filtersFromParams — only non-default values are written. */
export function paramsFromFilters(f: AnimalFilters): string {
  const p = new URLSearchParams();
  if (f.species.length) p.set('species', f.species.join(','));
  if (f.size.length) p.set('size', f.size.join(','));
  if (f.age.length) p.set('age', f.age.join(','));
  if (f.sex.length) p.set('sex', f.sex.join(','));
  if (f.goodWith.length) p.set('with', f.goodWith.join(','));
  if (f.search) p.set('q', f.search);
  if (f.includePending) p.set('pending', '1');
  if (f.sort !== 'newest') p.set('sort', f.sort);
  return p.toString();
}

export function isFiltered(f: AnimalFilters): boolean {
  return f.species.length > 0 || f.size.length > 0 || f.age.length > 0 || f.sex.length > 0
    || f.goodWith.length > 0 || f.search.length > 0;
}

/**
 * Apply filters to the full set. `Adopted` animals never appear here — they
 * belong in the separate "happy endings" section.
 */
export function applyFilters(animals: Animal[], f: AnimalFilters): Animal[] {
  const q = f.search.toLowerCase();
  const out = animals.filter((a) => {
    if (a.status === 'Adopted') return false;
    if (a.status === 'Pending' && !f.includePending) return false;
    if (f.species.length && !f.species.includes(a.species)) return false;
    if (f.size.length && !f.size.includes(a.size)) return false;
    if (f.sex.length && !f.sex.includes(a.sex)) return false;
    if (f.age.length) {
      const b = ageBracket(a.age);
      if (!b || !f.age.includes(b)) return false;
    }
    if (f.goodWith.includes('kids') && !a.goodWithKids) return false;
    if (f.goodWith.includes('dogs') && !a.goodWithDogs) return false;
    if (f.goodWith.includes('cats') && !a.goodWithCats) return false;
    if (q && !(`${a.name} ${a.breed}`.toLowerCase().includes(q))) return false;
    return true;
  });

  switch (f.sort) {
    case 'name': out.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'age':  out.sort((a, b) => (a.age ?? 1e9) - (b.age ?? 1e9)); break;
    default:
      out.sort((a, b) => String(b.intakeDate ?? '').localeCompare(String(a.intakeDate ?? '')));
  }
  return out;
}

export function happyEndings(animals: Animal[]): Animal[] {
  return animals
    .filter((a) => a.status === 'Adopted')
    .sort((a, b) => String(b.intakeDate ?? '').localeCompare(String(a.intakeDate ?? '')));
}
