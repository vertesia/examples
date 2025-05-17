import { initializeClient } from "../utils/client.js";
import { AgentMessageType } from "@vertesia/common";
import chalk from "chalk";
import inquirer from "inquirer";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

/**
 * Transform Vertesia resource links to full clickable URLs
 * Handles both 'store:objectId' and 'collection:collectionId' formats
 * @param message The message text to transform
 * @returns Transformed message with proper URLs
 */
function transformStoreLinks(message: string): string {
  // Get the studio URL from environment for constructing links
  const site = process.env.VERTESIA_ENVIRONMENT;
  let uiDomain: string;
  switch (site) {
    case "api-preview.vertesia.io":
      uiDomain = "preview.cloud.vertesia.io";
      break;
    case "api-staging.vertesia.io":
      uiDomain = "staging.cloud.vertesia.io";
      break;
    default:
      uiDomain = "cloud.vertesia.io";
  }

  // Regular expression to find store:objectId patterns
  // This regex matches 'store:' followed by alphanumeric characters and dashes
  const storeRegex = /store:([a-zA-Z0-9-]+)/g;

  // Regular expression to find collection:collectionId patterns
  const collectionRegex = /collection:([a-zA-Z0-9-]+)/g;

  // Replace store object references with proper URLs
  let transformedMessage = message.replace(storeRegex, (match, objectId) => {
    // Format: https://studioUrl/store/objects/objectId
    return `https://${uiDomain}/store/objects/${objectId}`;
  });

  // Replace collection references with proper URLs
  transformedMessage = transformedMessage.replace(
    collectionRegex,
    (match, collectionId) => {
      // Format: https://studioUrl/store/collections/collectionId
      return `https://${uiDomain}/store/collections/${collectionId}`;
    },
  );

  return transformedMessage;
}

/**
 * Format a message for display in the terminal
 * @param type Message type
 * @param message Message content
 * @param timestamp Message timestamp
 */
// Configure marked with the terminal renderer
// Cast to avoid TypeScript errors with newer marked versions
marked.setOptions({
  // @ts-expect-error - TerminalRenderer is compatible but has typing issues
  renderer: new TerminalRenderer({
    codespan: chalk.cyan,
    code: chalk.cyan,
    // Make list items truly yellow
    listitem: (text: string) => {
      // Apply yellow color to the bullet point
      if (text.startsWith("* ")) {
        return chalk.yellow("•") + " " + text.substring(2);
      } else if (/^\d+\./.test(text)) {
        // For numbered lists, color the number and period
        const parts = text.split(". ");
        return chalk.yellow(parts[0] + ".") + " " + parts.slice(1).join(". ");
      }
      return chalk.yellow(text);
    },
    list: chalk.yellow,
    table: chalk.magenta,
    strong: chalk.bold,
    em: chalk.italic,
    // Style links with white text and underline
    link: chalk.white.underline,
    href: chalk.white.underline,
  }),
});

function formatMessage(type: string, message: string, timestamp: number): void {
  const date = new Date(timestamp).toLocaleString();

  // Color messages based on type
  let typeColor;
  switch (type) {
    case AgentMessageType.QUESTION:
      typeColor = chalk.green("User:");
      break;
    case AgentMessageType.ERROR:
      typeColor = chalk.red("Error:");
      break;
    case AgentMessageType.COMPLETE:
      typeColor = chalk.green("Complete:");
      break;
    case AgentMessageType.IDLE:
      typeColor = chalk.yellow("Idle:");
      break;
    default:
      typeColor = chalk.blue("Agent:");
      break;
  }

  console.log(`${chalk.gray(date)} - ${typeColor}`);

  // Render markdown for agent messages only, not user messages or system status
  if (
    type !== AgentMessageType.QUESTION &&
    type !== AgentMessageType.IDLE &&
    type !== AgentMessageType.ERROR
  ) {
    // Transform store links to proper URLs before rendering markdown
    const transformedMessage = transformStoreLinks(message);

    // Render markdown
    console.log(marked(transformedMessage));
  } else {
    // Regular text for user messages and system messages
    console.log(`${message}\n`);
  }
}

/**
 * Start an interactive conversation with an agent
 * @param task Initial task description
 * @param agentType Type of agent to use
 */
export async function startInteractiveConversation(
  task: string,
  agentType: string = "MultipurposeAgent",
  interactive: boolean,
): Promise<void> {
  const vertesia = initializeClient();

  console.log(
    chalk.cyan(
      `Starting ${agentType} ${interactive ? "in interactive mode" : ""} with task: ${task}`,
    ),
  );

  try {
    // Start the conversation
    const run = await vertesia.interactions.executeAsync({
      type: "conversation",
      interaction: agentType,
      prompt_data: {
        task: task,
      },
      interactive: interactive,
    });

    console.log(chalk.green(`Run ID: ${run.runId}`));

    let conversationActive = true;
    let since = 0;

    while (conversationActive) {
      let streamEndReason;
      try {
        streamEndReason = await vertesia.workflows.streamMessages(
          run.runId,
          (item, exitFn) => {
            if (item.message) {
              formatMessage(item.type, item.message, item.timestamp);
            }
            // Exit the stream when the agent is waiting for input or done
            if (
              item.type === AgentMessageType.IDLE ||
              item.type === AgentMessageType.REQUEST_INPUT
            ) {
              if (exitFn) exitFn("input");
            } else if (item.type === AgentMessageType.COMPLETE) {
              if (exitFn) exitFn("done");
            }
          },
          since,
        );
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(chalk.red("Error while streaming messages:"), error);
          return;
        }
      }

      since = Date.now();

      if (streamEndReason === "input") {
        // Get user input
        const { userInput } = await inquirer.prompt([
          {
            type: "input",
            name: "userInput",
            message: chalk.green("You:"),
            validate: (input) => !!input.trim() || "Please enter a message",
          },
        ]);
        // Send user input to the agent
        await vertesia.workflows.sendSignal(
          run.workflowId,
          run.runId,
          "UserInput",
          {
            message: userInput,
          },
        );
      } else {
        conversationActive = false;
      }
    }

    console.log(chalk.green("Conversation completed"));
  } catch (error: unknown) {
    console.error(chalk.red("Error during conversation:"), error);
    process.exitCode = 1;
  }
}
