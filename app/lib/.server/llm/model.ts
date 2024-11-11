import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider';
import { getAPIKey } from './api-key';

export type ModelType = "claude-3-5-sonnet-20240620" | "claude-3-opus-20240229" | "gpt-4o" | "o1-preview" | "gemini-1.5-flash-exp-0827" | "gemini-1.5-pro-exp-0827" | "grok-2" | "grok-2-mini"
export type UserModelType = { "uid": string, "model": string }

export let currentModel: Record<string, UserModelType> = {}

const providers = getAPIKey() as Record<string, {
  apiKey: string;
  baseUrl: string;
}>;

export function getModel(model: string) {
  if (!model) throw new Error(`Invalid model: ${model}`);

  const [provider, modelId] = model?.split("@");
  const modelData = providers[provider]

  if (!modelData) throw new Error(`Provider not found: ${provider}`);

  // Anthropic and OpenAI have different api implementations
  const _model = provider === 'ANTHROPIC' ?
    createAnthropic({
      baseURL: modelData.baseUrl,
      apiKey: modelData.apiKey
    }) : ((provider === 'OLLAMA') ?
      createOpenAI({
        baseURL: modelData.baseUrl,
      }) : createOpenAI({
        baseURL: modelData.baseUrl,
        apiKey: modelData.apiKey,
      }));

  return _model(modelId);
}

export function setModel(model: string, uid: string) {
  currentModel[uid] = { uid, model }
}