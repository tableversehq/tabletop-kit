export function createRootHelpText(): string {
  return [
    "tvk",
    "",
    "Commands:",
    "  generate",
    "  validate",
    "  login",
    "  logout",
    "  whoami",
  ].join("\n");
}

export function createGenerateHelpText(): string {
  return [
    "tvk generate",
    "",
    "Targets:",
    "  client-sdk",
    "",
    "Optional flags:",
    "  --config <path>",
    "  --outDir <path>",
  ].join("\n");
}

export function createValidateHelpText(): string {
  return ["tvk validate", "", "Optional flags:", "  --config <path>"].join(
    "\n",
  );
}

const ENVIRONMENT_HELP = [
  "Environment:",
  "  TABLEVERSE_API_URL   platform-api base URL (default https://api-dev.tableverse.io)",
  "  TABLEVERSE_WEB_URL   platform-web base URL (default https://dev.tableverse.io)",
];

export function createLoginHelpText(): string {
  return [
    "tvk login",
    "",
    "Authenticate with the Tableverse platform in your browser.",
    "Credentials are stored per API base URL, so separate environments do not",
    "overwrite each other.",
    "",
    ...ENVIRONMENT_HELP,
  ].join("\n");
}

export function createLogoutHelpText(): string {
  return [
    "tvk logout",
    "",
    "Revoke the stored refresh token and remove local credentials.",
    "",
    ...ENVIRONMENT_HELP,
  ].join("\n");
}

export function createWhoamiHelpText(): string {
  return [
    "tvk whoami",
    "",
    "Print the currently logged-in account.",
    "",
    ...ENVIRONMENT_HELP,
  ].join("\n");
}
