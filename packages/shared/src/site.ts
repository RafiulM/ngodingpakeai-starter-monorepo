import starter from "../../../starter.config.json" with { type: "json" };

// App identity, read from starter.config.json at the repository root. Change
// the name and description there; both apps pick them up.
export const siteConfig = {
  id: starter.id,
  name: starter.name,
  description: starter.description,
  homePath: "/app",
} as const;
