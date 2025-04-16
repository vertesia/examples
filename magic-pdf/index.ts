import path from 'node:path';
import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { StreamSource, VertesiaClient } from '@vertesia/client';
import { createReadStream } from 'fs';
import { createReadableStreamFromReadable } from 'node-web-stream-adapters';
import {
  DocAnalyzeRunStatusResponse,
  WorkflowExecutionStatus,
  //  DocTableJson
} from '@vertesia/common';
import { S } from 'fluent-json-schema';
import papaparse from 'papaparse';

// Set up command-line interface with Commander
const program = new Command();
program
  .name('magic-pdf')
  .description(
    'Analyze a PDF file and generate a structured representation in XML',
  )
  .version('0.0.1')
  .requiredOption('-i, --input <file>', 'The PDF file to upload and analyze')
  .parse(process.argv);

const options = program.opts();

// Load environment variables from .env file
dotenv.config();
const apikey = process.env.API_KEY;

// Initialize client
const client = new VertesiaClient({
  storeUrl: process.env.ZENO_URL as string,
  serverUrl: process.env.STUDIO_URL as string,
  apikey,
});

// Upload PDF file
const filename = path.basename(options.input);
if (!filename.toLowerCase().endsWith('.pdf')) {
  console.error('The input file must be a PDF file.');
  process.exit(1);
}

const stream = createReadStream(options.input);
const content = new StreamSource(
  createReadableStreamFromReadable(stream),
  path.basename(options.input),
  'application/pdf',
);
const object = await client.objects.create({
  content: content,
});

console.log('Created object:', object.id);

// Run analysis
const analysisRun = await client.objects.analyze(object.id).start({
  features: [],
});
console.log('Analysis Started', analysisRun);

// Get Status
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const printProgress = (progress: string) => {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(progress);
};

let analysisStatus: DocAnalyzeRunStatusResponse;
do {
  await delay(5000);
  analysisStatus = await client.objects.analyze(object.id).getStatus();
  //  console.log(`Progress: ${status.progress?.percent} %`);
  printProgress(`Progress: ${analysisStatus.progress?.percent} %`);
} while (analysisStatus.status === WorkflowExecutionStatus.RUNNING);

if (analysisStatus.status !== WorkflowExecutionStatus.COMPLETED) {
  console.error(`\nAnalysis failed with status: ${analysisStatus.status}`);
  process.exit(-1);
}

console.log(`\nAnalysis was completed successfully`);

// Get Results
// const results = await client.objects.analyze(object.id).getResults();
// console.log(results.document);

console.log(`Converting line item tables to csv file`);

const target_schema = S.object()
  .title('Invoice line item schema')
  .description('A line item')
  .prop(
    'line_item_number',
    S.string().description(
      'A simple identifier number for the line item which is unique and incremental',
    ),
  )
  .prop('hs_code', S.string())
  .prop('product_code', S.string())
  .prop('description', S.string())
  .prop('country_of_origin', S.string())
  .prop('quantity', S.number().minimum(0))
  .prop('unit_price', S.number().minimum(0))
  .prop('amount', S.number().minimum(0))
  .valueOf();

console.log('Target Schema', target_schema);

const instructions = `A valid invoice line item table features rows such as description, quantity, unit price, and amount columns.`;

const adaptTablesRun = await client.objects
  .analyze(object.id)
  .post('/adapt_tables', {
    payload: {
      instructions: instructions,
      item_name: 'invoice line item',
      target_schema: JSON.stringify(target_schema),
    },
  });
console.log(adaptTablesRun);

const status = await client.objects
  .analyze(object.id)
  .get(`/adapt_tables/${adaptTablesRun.workflow_run_id}`, {query: {format: 'json'}});

console.log(status);

const stats = [];
let allLineItems: object[] = [];
for (const property in status) {
  stats.push({
    tableId: property,
    title: status[property].comment,
    nbItems: status[property].data.length,
  });
  allLineItems = allLineItems.concat(status[property].data);
}

console.log('Processed Tables', stats);

console.log('Number of line items: ', allLineItems.length);

const csv = papaparse.unparse(allLineItems);

console.log(csv);
