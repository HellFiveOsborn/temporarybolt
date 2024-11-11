import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { currentModel, getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { stripIndents } from '~/utils/stripIndent';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export function streamText(
  uid: string,
  messages: Messages,
  model?: string,
  options?: StreamingOptions
) {
  const selectedModel = currentModel[uid]?.model || model;
  return _streamText({ // @ts-ignore
    model: getModel(selectedModel),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    messages: convertToCoreMessages([
      { role: "system", content: getSystemPrompt() }, // @ts-ignore
      ...messages
    ]),
    ...options,
  });
}

export function streamTextPromptEnhancer(
  uid: string,
  prompt: string,
  model?: string,
  options?: StreamingOptions
) {
  const SYSTEM_PROMPT = stripIndents`
    Your task is to refine the user prompt

    Refine the user prompt provided within \`<original_prompt>\` tags.

    IMPORTANT GUIDELINES:

    1. Analyze Thoroughly: Examine the original prompt’s content closely.
    2. Enhance Clarity and Depth: Improve clarity, structure, and precision while maintaining the original intent.
    3. Use Formal and Concise Language: Choose formal, straightforward language where appropriate.
    4. Add Context or Examples if Necessary: Provide additional context or examples to clarify the user’s request.
    5. Focus on Prompt Enhancement Only: Do not include explanations, comments, or markup—focus strictly on refining the prompt content.
    6. No explanations, comments, or markdown are required.
    7. Always convert to english output

    <original_prompt> 
      ${prompt}
    </original_prompt>
  `;
  const selectedModel = model;
  return _streamText({ // @ts-ignore
    model: getModel(selectedModel),
    system: SYSTEM_PROMPT,
    maxTokens: 512,
    messages: convertToCoreMessages([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `User prompt: ${prompt}` }
    ]),
    ...options,
  });
}

export function autoComplete(
  uid: string,
  prefix: string,
  suffix: string,
  language: string,
  model?: string,
  options?: StreamingOptions
) {
  const SYSTEM_PROMPT = stripIndents`
    You are an expert ${language || "software"} developer focused on completing code at the cursor position without altering the surrounding structure.
    
    Guidelines:
    1. Complete the code immediately after "<FILL_ME>", maintaining the code flow without adding extra syntax like markdown or other formatting.
    2. Use the existing code style, indentation, and surrounding context for seamless integration.
    3. Do not add new blocks, comments, or extra braces unless explicitly required by the code.
    4. Follow existing naming conventions and patterns visible in the context.
    5. Only complete the current logical unit, like an attribute, function, or statement, without adding unnecessary elements.
    6. Avoid any output in Markdown format or enclosed by additional symbols or tags.

    Context: ${language || "I don't know what language it is"} code
    Code Before Cursor: ${prefix}
    Code After Cursor: ${suffix}
  `;

  const selectedModel = model;

  return _streamText({ // @ts-ignore
    model: getModel(selectedModel),
    system: SYSTEM_PROMPT,
    temperature: 0.2,
    maxTokens: 512,
    messages: convertToCoreMessages([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${prefix}<FILL_ME>${suffix}` }
    ]),
    ...options,
  });
}