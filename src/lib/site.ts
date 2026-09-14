/**
 * Single source of truth for the shelter's real-world details.
 * Everything a non-technical owner might want to change about contact
 * details or opening hours lives here, not scattered through the pages.
 */

export const SITE = {
  name: 'Willowbrook Animal Rescue',
  shortName: 'Willowbrook',
  tagline: 'Rehoming dogs, cats and rabbits across Bristol and the South West',
  description:
    'Willowbrook Animal Rescue rehomes dogs, cats and rabbits across Bristol and the South West. ' +
    'Meet the animals looking for homes and apply to adopt.',
  locale: 'en_GB',
  lang: 'en-GB',
  currency: 'GBP',

  address: {
    line1: 'Willowbrook Farm, Bridgwater Road',
    locality: 'Bristol',
    region: 'Somerset',
    postcode: 'BS13 8AF',
    country: 'United Kingdom',
    countryCode: 'GB',
  },

  phone: '0117 496 0142',
  phoneHref: '+441174960142',
  email: 'hello@willowbrookrescue.org.uk',
  adoptionsEmail: 'adoptions@willowbrookrescue.org.uk',

  /** Approximate — used only for the embedded map. */
  geo: { lat: 51.4155, lng: -2.6206 },

  /** Rendered on the contact page and in the footer. */
  hours: [
    { days: 'Monday', time: 'Closed' },
    { days: 'Tuesday – Friday', time: '11am – 4pm' },
    { days: 'Saturday', time: '10am – 5pm' },
    { days: 'Sunday', time: '10am – 2pm' },
  ],

  /** Placeholder figures — the owner replaces these in one place. */
  stats: [
    { value: '4,180', label: 'animals rehomed' },
    { value: '23', label: 'years running' },
    { value: '96', label: 'active volunteers' },
    { value: '11', label: 'staff and vets' },
  ],

  /** How long applicants should expect to wait. */
  applicationResponseDays: '3 to 5 working days',
} as const;

export const NAV = [
  { href: '/adopt', label: 'Adopt' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
