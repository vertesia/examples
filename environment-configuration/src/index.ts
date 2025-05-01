import { Command } from "commander";
import { VertesiaClient } from "@vertesia/client";
import { configureBedrockEnvironment } from "./aws-bedrock.js";

const apikey = process.env.VERTESIA_API_TOKEN ? process.env.VERTESIA_API_TOKEN : process.env.VERTESIA_API_KEY;

if (!apikey) {
  console.error("Please set the VERTESIA_API_TOKEN or VERTESIA_API_KEY environment variable.");
  process.exit(1);
}

// Initialize client
const vertesia = new VertesiaClient({
  storeUrl: process.env.ZENO_URL ? process.env.ZENO_URL : "https://api.vertesia.io",
  serverUrl: process.env.STUDIO_URL ? process.env.STUDIO_URL : "https://api.vertesia.io",
  apikey,
});

// Set up command-line interface with Commander
const program = new Command();
program
  .name("environment-configuration")
  .description("Set up Vertesia Execution Environment configuration")
  .version("0.0.1");

program
  .command("aws")
  .description("Configure AWS Bedrock Execution environment")
  .requiredOption("-r, --region <file>", "The AWS region to use")
  .option("--env", "The Vertesia Execution Environment Name", "AWS Bedrock")
  .option("--role", "The AWS Role Name", "VertesiaBedrockRole")
  .option("-t,--tags <tags...>", "List of tags in the format key=value")
  .action((options) => {
    const tags = options.tags?.map((tag:string) => {
      const [key, value] = tag.split("=");
      return { Key: key, Value: value };
    });  

    return configureBedrockEnvironment(
      vertesia,
      options.region,
      options.env,
      options.role,
      tags,
    )},
  );

program.parseAsync(process.argv);
