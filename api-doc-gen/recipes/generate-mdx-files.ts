import { JsonObject } from "@vertesia/memory";
import { copyText, json, vars } from "@vertesia/memory-commands";
/**
 * This recipe is expecting the output content.json file
 * of the iterative api doc generation and outputs a tar containing one mdx file by section
 */

const { input } = vars();
if (!input) {
    throw new Error('Input JSON file not specified. Use --var-input to specify the input content.json file');
}
console.log("Using generated memory pack at", input);

function createSectionPage(section: any, meta?: Record<string, string>) {
    const content: string[] = [];
    const props = {
        title: section.name,
        ...meta
    }
    content.push(`export const metadata = {`);
    for (const key of Object.keys(props)) {
        content.push(`    ${key}: ${JSON.stringify(props[key])},`);
    }
    content.push(`}`);
    content.push('');
    content.push(section.content);
    content.push('');
    return content.join('\n');
}

const inputContent = json(input) as JsonObject;
const sections = await inputContent.getJsonValue() as any[];
const now = new Date().toISOString();
for (const section of sections) {
    copyText(createSectionPage(section, { generated_at: now }), `${section.id}/page.mdx`);
}

export default {}
