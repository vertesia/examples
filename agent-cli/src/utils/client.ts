import { VertesiaClient } from "@vertesia/client";
import chalk from "chalk";

/**
 * Initialize the Vertesia client with environment variables
 * @returns Configured Vertesia client
 */
export function initializeClient(): VertesiaClient {
  const apikey = process.env.VERTESIA_API_KEY;
  const environment = process.env.VERTESIA_ENVIRONMENT || "api.vertesia.io";

  if (!apikey) {
    console.error(chalk.red("Error: API_KEY environment variable is required"));
    console.log(
      chalk.yellow(
        "Please add your API key to a .env file or environment variables",
      ),
    );
    process.exit(1);
  }

  if (
    ![
      "api.vertesia.io",
      "api-preview.vertesia.io",
      "api-staging.vertesia.io",
    ].includes(environment)
  ) {
    console.error(chalk.red("Error: Invalid environment specified"));
    console.log(
      chalk.yellow(
        "Please use 'api.vertesia.io' for production or 'api-preview.vertesia.io' for preview",
      ),
    );
    process.exit(1);
  }

  return new VertesiaClient({
    apikey: apikey,
    site: environment as
      | "api.vertesia.io"
      | "api-preview.vertesia.io"
      | "api-staging.vertesia.io",
  });
}
