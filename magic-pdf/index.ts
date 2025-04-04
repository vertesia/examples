import path from 'node:path';
import * as dotenv from "dotenv";
import { Command } from "commander";
import { StreamSource, VertesiaClient } from "@vertesia/client";
import { createReadStream } from "fs";
import { createReadableStreamFromReadable } from "node-web-stream-adapters";
import { DocAnalyzeRunStatusResponse, WorkflowExecutionStatus } from '@vertesia/common';


// Set up command-line interface with Commander
const program = new Command();
program.name("magic-pdf")
    .description("Analyze a PDF file and generate a structured representation in XML")
    .version("1.0.0")
    .requiredOption("-i, --input <file>", "The PDF file to upload and analyze")
    .parse(process.argv);

const options = program.opts();

// Load environment variables from .env file
dotenv.config();
const apikey = process.env.API_KEY;

// Initialize client
const client = new VertesiaClient({
    storeUrl: "https://zeno-server-staging.api.vertesia.io",
    serverUrl: "https://studio-server-staging.api.vertesia.io",
    apikey,
});

// Upload PDF file
const filename = path.basename(options.input);
if (!filename.toLowerCase().endsWith(".pdf")) {
    console.error("The input file must be a PDF file.");
    process.exit(1);
}

const stream = createReadStream(options.input);
const content = new StreamSource(createReadableStreamFromReadable(stream), path.basename(options.input), "application/pdf");
const object = await client.objects.create({
    content: content
});

console.log("Created object:", object.id);

// Run analysis
const analysisRun = await client.objects.analyze(object.id).start({
    features:[]
});
console.log("Analysis Started", analysisRun);

// Get Status
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let status:DocAnalyzeRunStatusResponse;
do {
    await delay(5000);
    status = await client.objects.analyze(object.id).getStatus();
    console.log(`Progress: ${status.progress?.percent} %`);
} while (status.status === WorkflowExecutionStatus.RUNNING);

// Get Results
const results = await client.objects.analyze(object.id).getResults();
console.log(results.document);

