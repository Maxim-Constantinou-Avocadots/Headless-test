/**
 * Email notifications for form submissions.
 *
 * STATUS: not wired up. The Wix Headless skill does not expose an automations
 * or triggered-email mechanism for a managed Astro project, so there is no
 * supported server-side send to call here. Rather than pretend, these two
 * functions log what would be sent and return cleanly, so the submission flow
 * is complete and nothing silently fails.
 *
 * TO WIRE THIS UP, pick one of:
 *
 *  1. Wix Automations (no code). In the dashboard go to Automations > New
 *     Automation, trigger "Form submitted" or a scheduled check over the
 *     AdoptionApplications collection, action "Send email". This is the route
 *     to recommend to a non-technical owner.
 *
 *  2. A transactional email provider (code). Add an API key as a SECRET server
 *     env var — declare it in `astro.config.mjs` under `env.schema` with
 *     `context: 'server', access: 'secret'`, then set it with:
 *         npx @wix/cli@latest env set --key=EMAIL_API_KEY --value=...
 *     Import it from 'astro:env/server' and POST to the provider here.
 *     Never inline a key in this file.
 *
 * Both send paths belong on the server only — these functions are imported
 * exclusively by `src/pages/api/*` routes, never by browser code.
 */

import { SITE } from '../site';

export interface ApplicationNotification {
  applicantName: string;
  applicantEmail: string;
  animalName: string;
  applicationId: string;
}

/** Tells the shelter a new application has arrived. */
export async function notifyShelterOfApplication(n: ApplicationNotification): Promise<void> {
  console.info(
    `[notify:stub] New adoption application for ${n.animalName} from ${n.applicantName}. ` +
    `Would email ${SITE.adoptionsEmail} (application ${n.applicationId}).`,
  );
}

/** Confirms to the applicant that we have their form. */
export async function confirmApplicationToApplicant(n: ApplicationNotification): Promise<void> {
  console.info(
    `[notify:stub] Would email ${n.applicantEmail} confirming their application ` +
    `for ${n.animalName}, response expected within ${SITE.applicationResponseDays}.`,
  );
}

/** Tells the shelter someone used the contact form. */
export async function notifyShelterOfEnquiry(name: string, email: string): Promise<void> {
  console.info(`[notify:stub] New enquiry from ${name} <${email}>. Would email ${SITE.email}.`);
}
