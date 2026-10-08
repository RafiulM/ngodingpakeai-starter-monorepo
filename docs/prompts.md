# Prompts to start building

## Start locally

> Read AGENTS.md and use starter-setup. Set up this project, start both apps, and explain how I can open them.

## First feature

> Use build-feature. I want a personal reading list. I can add a book with a title and author, mark it finished, and remove it. Each account should only see its own books. Add the Express route and service, the shared validator, and TanStack Query hooks like the Notes example, and use Context7. Build the simplest complete version and test it.

## Change the look

> Give this app a more playful visual style. Keep the pages readable on a phone, reuse our shadcn components and Tailwind tokens, and respect reduced motion. Keep signup and signin working.

## Diagnose a problem

> The app shows this error: [paste the error, without secrets]. Read our project instructions, find the matching reqId in the API and web logs, fix the cause, and explain the fix in plain language. Keep my existing data.

## Start a derivative

> Use create-variant to create a dashboard starter in ../my-dashboard. It is for freelancers tracking client projects. Start with a project list and simple status counts, using real data owned by the signed-in user. Preserve the base setup and AI workflow.

## Verify a feature

> Check the feature you just built. Test the normal path, missing inputs, and whether one account can access another account's records. Run the relevant project checks and tell me what passed.

## Another backend feature

> Read AGENTS.md and use build-feature. Add a bookmarks API following the Notes backend standard: an Express router with requireAuth and the origin check, strict shared validation, all Drizzle queries in a service, and a separate schema file. Each user should only access their own bookmarks. Add hooks and a page in the web app, generate a migration, and test CRUD and account isolation.

## Add a role

> Add a "support" role that can read every account's notes but not delete them. Declare it in the shared permissions, guard the API and the admin page, and test that support can list but gets 403 on delete.
