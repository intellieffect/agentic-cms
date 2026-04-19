#!/usr/bin/env node
import { createGeneratePrompt } from './prompts/generatePrompt.js';
import { selectPreset } from './prompts/stylePresets.js';
import { validateContentGuidelines } from './prompts/contentGuidelines.js';
import { validateContentLength } from './prompts/generatePrompt.js';
import { convertToPlateFormat } from './converters/plateConverter.js';
import { createEnrichPrompt } from './prompts/enrichPrompt.js';
import { validateEnrichment } from './validators/enrichValidator.js';
function writeError(message) {
    process.stderr.write(JSON.stringify({ error: message }) + '\n');
    process.exit(1);
}
function parseArgs(argv) {
    const command = argv[2];
    if (!command) {
        writeError('No command provided. Available: generate-prompt, select-preset, validate, validate-length, convert-plate, enrich-prompt, validate-enrich');
    }
    const flags = {};
    for (let i = 3; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                writeError(`Missing value for flag --${key}`);
            }
            flags[key] = value;
            i++;
        }
    }
    return { command, flags };
}
function parseJSON(raw, label) {
    try {
        return JSON.parse(raw);
    }
    catch {
        writeError(`Invalid JSON for --${label}`);
    }
}
function readStdin() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        process.stdin.on('data', (chunk) => chunks.push(chunk));
        process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        process.stdin.on('error', reject);
    });
}
const { command, flags } = parseArgs(process.argv);
switch (command) {
    case 'generate-prompt': {
        const topic = flags['topic'];
        const category = flags['category'];
        if (!topic)
            writeError('--topic is required');
        if (!category)
            writeError('--category is required');
        const keywords = flags['keywords'] ? flags['keywords'].split(',').map(k => k.trim()) : undefined;
        const stylePreset = flags['style-preset'] ? parseJSON(flags['style-preset'], 'style-preset') : undefined;
        const result = createGeneratePrompt({ topic, category, keywords, stylePreset });
        process.stdout.write(result);
        break;
    }
    case 'select-preset': {
        const recent = flags['recent'] ? parseJSON(flags['recent'], 'recent') : [];
        const result = selectPreset(recent);
        process.stdout.write(JSON.stringify(result));
        break;
    }
    case 'validate': {
        const input = await readStdin();
        if (!input.trim())
            writeError('No input provided via stdin');
        const result = validateContentGuidelines(input);
        process.stdout.write(JSON.stringify(result));
        break;
    }
    case 'validate-length': {
        const input = await readStdin();
        if (!input.trim())
            writeError('No input provided via stdin');
        const result = validateContentLength(input);
        process.stdout.write(JSON.stringify(result));
        break;
    }
    case 'convert-plate': {
        const input = await readStdin();
        if (!input.trim())
            writeError('No input provided via stdin');
        const topic = flags['topic'];
        const category = flags['category'];
        const context = topic && category ? { topic, category } : undefined;
        const result = await convertToPlateFormat(input, context, undefined);
        process.stdout.write(JSON.stringify(result.content));
        break;
    }
    case 'enrich-prompt': {
        const input = await readStdin();
        if (!input.trim())
            writeError('No input provided via stdin');
        const result = createEnrichPrompt(input);
        process.stdout.write(result);
        break;
    }
    case 'validate-enrich': {
        const input = await readStdin();
        if (!input.trim())
            writeError('No input provided via stdin');
        const parsed = parseJSON(input, 'stdin');
        if (!parsed.original || !parsed.enriched)
            writeError('JSON must have "original" and "enriched" fields');
        const result = validateEnrichment(parsed.original, parsed.enriched);
        process.stdout.write(JSON.stringify(result));
        break;
    }
    default:
        writeError(`Unknown command: ${command}. Available: generate-prompt, select-preset, validate, validate-length, convert-plate, enrich-prompt, validate-enrich`);
}
//# sourceMappingURL=cli.js.map