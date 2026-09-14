import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { items } from '@wix/data';
import { rateLimit, clientKey } from '../../lib/server/rateLimit';
import { str, num, bool, isEmail, isPhone, isHoneypotTripped, type Errors } from '../../lib/server/validate';
import { notifyShelterOfApplication, confirmApplicationToApplicant } from '../../lib/server/notify';

export const prerender = false;

const COLLECTION = 'AdoptionApplications';
const ANIMALS = 'Animals';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Adoption application.
 *
 * Applications carry personal data, so AdoptionApplications is admin-read and
 * admin-write — a browser cannot read or write it. This route is the only
 * path in. Every rule the client-side form enforces is re-checked here,
 * because the client copy is a convenience and this one is the control.
 */
export const POST: APIRoute = async ({ request }) => {
  // Tighter than the other forms: a real person submits this once.
  const limit = rateLimit(clientKey(request, 'apply'), 3, 10 * 60_000);
  if (!limit.ok) {
    return json({
      status: 'error',
      message: 'That is a lot of applications in a short time. Please wait a few minutes, or ring us.',
    }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', message: 'Could not read that submission.' }, 400);
  }

  if (isHoneypotTripped(body)) return json({ status: 'ok', redirect: '/apply/thank-you' });

  const f = {
    animalId:        str(body.animalId, 80),
    firstName:       str(body.firstName, 80),
    lastName:        str(body.lastName, 80),
    email:           str(body.email, 254),
    phone:           str(body.phone, 40),
    addressLine1:    str(body.addressLine1, 200),
    city:            str(body.city, 100),
    postalCode:      str(body.postalCode, 20),
    country:         str(body.country, 100) || 'United Kingdom',
    over18:          bool(body.over18),
    homeType:        str(body.homeType, 40),
    ownOrRent:       str(body.ownOrRent, 40),
    landlordPermission: bool(body.landlordPermission),
    hasGarden:       bool(body.hasGarden),
    householdAdults: num(body.householdAdults),
    householdChildren: num(body.householdChildren),
    childrenAges:    str(body.childrenAges, 200),
    otherPets:       str(body.otherPets, 1000),
    previousPets:    str(body.previousPets, 1000),
    hoursAloneDaily: num(body.hoursAloneDaily),
    whyThisAnimal:   str(body.whyThisAnimal, 4000),
    vetName:         str(body.vetName, 200),
    agreeHomeCheck:  bool(body.agreeHomeCheck),
    agreeTerms:      bool(body.agreeTerms),
  };

  const errors: Errors = {};

  if (!f.animalId) errors.animalId = 'Please choose which animal you are applying for.';
  if (!f.firstName) errors.firstName = 'Please enter your first name.';
  if (!f.lastName) errors.lastName = 'Please enter your last name.';
  if (!f.email) errors.email = 'Please enter your email address.';
  else if (!isEmail(f.email)) errors.email = 'That does not look like an email address.';
  if (!f.phone) errors.phone = 'Please enter a phone number.';
  else if (!isPhone(f.phone)) errors.phone = 'Please enter a phone number we can reach you on.';
  if (!f.addressLine1) errors.addressLine1 = 'Please enter your address.';
  if (!f.city) errors.city = 'Please enter your town or city.';
  if (!f.postalCode) errors.postalCode = 'Please enter your postcode.';
  if (!f.over18) errors.over18 = 'We can only rehome to adults over 18.';
  if (!f.homeType) errors.homeType = 'Please tell us what kind of home you have.';
  if (!f.ownOrRent) errors.ownOrRent = 'Please tell us whether you own or rent.';

  // Conditional: renters need their landlord's permission.
  if (f.ownOrRent === 'Rent' && !f.landlordPermission) {
    errors.landlordPermission = 'We need confirmation that your landlord allows pets.';
  }
  // Conditional: if there are children, we need their ages.
  if ((f.householdChildren ?? 0) > 0 && !f.childrenAges) {
    errors.childrenAges = 'Please tell us the ages of the children at home.';
  }

  if (f.householdAdults == null || f.householdAdults < 1) {
    errors.householdAdults = 'Please tell us how many adults live with you.';
  }
  if (f.householdChildren == null || f.householdChildren < 0) {
    errors.householdChildren = 'Please enter 0 if there are no children.';
  }
  if (f.hoursAloneDaily == null || f.hoursAloneDaily < 0 || f.hoursAloneDaily > 24) {
    errors.hoursAloneDaily = 'Please enter a number of hours between 0 and 24.';
  }
  if (!f.whyThisAnimal) errors.whyThisAnimal = 'Please tell us a little about why this animal.';
  if (!f.agreeHomeCheck) errors.agreeHomeCheck = 'We home-check every adopter, so this one is required.';
  if (!f.agreeTerms) errors.agreeTerms = 'Please accept the adoption terms.';

  if (Object.keys(errors).length) return json({ status: 'invalid', errors }, 400);

  try {
    // Resolve the animal server-side so the stored name is ours, not the
    // browser's — and so an application cannot be filed against an animal
    // that does not exist.
    const findAnimal = auth.elevate(
      async () => items.query(ANIMALS).eq('_id', f.animalId).limit(1).find(),
    );
    const animalRes = await findAnimal();
    const animal = (animalRes.items ?? [])[0] as Record<string, any> | undefined;
    if (!animal) {
      return json({ status: 'invalid', errors: { animalId: 'That animal is no longer listed.' } }, 400);
    }
    if (animal.status === 'Adopted') {
      return json({
        status: 'invalid',
        errors: { animalId: `${animal.name} has already found a home. Please choose another animal.` },
      }, 400);
    }

    const insert = auth.elevate(items.insert);
    const created = await insert(COLLECTION, {
      animalRef: animal._id,
      // Snapshot the name so the record still reads clearly if the animal
      // record is deleted later.
      animalName: animal.name,
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email,
      phone: f.phone,
      addressLine1: f.addressLine1,
      city: f.city,
      postalCode: f.postalCode,
      country: f.country,
      over18: f.over18,
      homeType: f.homeType,
      ownOrRent: f.ownOrRent,
      landlordPermission: f.landlordPermission,
      hasGarden: f.hasGarden,
      householdAdults: f.householdAdults,
      householdChildren: f.householdChildren,
      childrenAges: f.childrenAges,
      otherPets: f.otherPets,
      previousPets: f.previousPets,
      hoursAloneDaily: f.hoursAloneDaily,
      whyThisAnimal: f.whyThisAnimal,
      vetName: f.vetName,
      agreeHomeCheck: f.agreeHomeCheck,
      agreeTerms: f.agreeTerms,
      // Set here, never trusted from the browser.
      submittedAt: new Date(),
      applicationStatus: 'New',
    });

    const notification = {
      applicantName: `${f.firstName} ${f.lastName}`,
      applicantEmail: f.email,
      animalName: animal.name,
      applicationId: (created as any)?._id ?? '',
    };
    // Notifications must never fail the submission — the record is already safe.
    await Promise.allSettled([
      notifyShelterOfApplication(notification),
      confirmApplicationToApplicant(notification),
    ]);

    return json({
      status: 'ok',
      redirect: `/apply/thank-you?animal=${encodeURIComponent(animal.name)}`,
    });
  } catch (err) {
    console.error('[api/apply] failed', err);
    return json({
      status: 'error',
      message: 'Something went wrong our end and your application was not saved. Please try again, or ring us.',
    }, 500);
  }
};
