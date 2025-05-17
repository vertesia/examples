#!/usr/bin/env node
import * as dotenv from "dotenv";
import { program } from "commander";
import { startInteractiveConversation } from "./commands/conversation.js";
import chalk from "chalk";

// Load environment variables from .env file
dotenv.config();

// Set up the CLI program
program
  .name("agent-cli")
  .description("Vertesia Agent Runner CLI")
  .version("1.0.0");

// Add run command
program
  .command("run")
  .description("Run an agent with a task")
  .argument("<task>", "Task description for the agent")
  .option("-i, --interactive", "Enable interactive mode")
  .option("-a, --agent <agent>", "Agent type to use", "MultipurposeAgent")
  .action(async (task, options) => {
    try {
      await startInteractiveConversation(
        task,
        options.agent,
        options.interactive,
      );
    } catch (error) {
      console.error(chalk.red("Error running agent:"), error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}
