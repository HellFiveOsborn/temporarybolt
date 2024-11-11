import { json, type ActionFunction } from "@remix-run/cloudflare";
import { currentModel } from "~/lib/.server/llm/model";
import { getAPIKey } from "~/lib/.server/llm/api-key";

interface Model {
  id: string;
  name: string;
  contextWindow?: string;
  maxOutput?: string;
  vision?: boolean;
}

interface Provider {
  name: string;
  //apiKey: string;
  baseUrl?: string;
  models: Model[];
}

const ANTHROPIC_MODELS = [
  {
    id: "claude-3-5-sonnet-latest",
    name: "Claude 3.5 Sonnet",
    contextWindow: "200000",
    maxOutput: "8192",
    vision: true
  }
];

const providers = getAPIKey() as Record<string, {
  apiKey: string;
  baseUrl: string;
}>;

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const uid = formData.get("uid");

  const providersEntries = Object.entries(providers);

  const providersData: Provider[] = await Promise.all(
    providersEntries.map(async ([name, { apiKey, baseUrl }]) => {
      try {
        let models: Model[] = [];

        switch (name) {
          case 'ANTHROPIC':
            models = ANTHROPIC_MODELS;
            break;

          case 'OPENAI':
            const openaiResponse = await fetch(baseUrl ? `${baseUrl}/models` : 'https://api.openai.com/v1/models', {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const openaiData = await openaiResponse.json() as any;
            models = openaiData.data.map((model: any) => ({
              id: model.id,
              name: model.id,
              contextWindow: model?.context_window || 0,
              maxOutput: model?.max_tokens || 0,
              vision: true
            }));
            break;

          case 'GROQ':
            const groqResponse = await fetch(baseUrl ? `${baseUrl}/models` : 'https://api.groq.com/openai/v1/models', {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const groqData = await groqResponse.json() as any;
            models = groqData.data.map((model: any) => ({
              id: model.id,
              name: model.id,
              contextWindow: model?.context_window || 0,
              maxOutput: model?.max_tokens || 0,
              vision: model.id.includes('vision') ? true : false,
            }));
            break;

          default:
            // Custom provider using OpenAI-compatible API
            if (baseUrl) {
              const response = await fetch(`${baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
              });
              const data = await response.json() as any;

              models = data.data.map((model: any) => ({
                id: model.id,
                name: model.id,
                contextWindow: model?.context_window || 0,
                maxOutput: model?.max_tokens || 0,
                vision: model.id.includes('vision') ? true :
                  model.id.includes('4o') || model.id.includes('o1') ? true :
                    model.id.includes('sonnet') || model.id.includes('haiku') ? true : false,
              }));
            }
        }

        if (models.length > 0) {
          return {
            name,
            // apiKey,
            baseUrl,
            models
          };
        }
      } catch (error) {
        console.error(`Error fetching models for ${name}:`, error);
        return null;
      }
    })
  ) as Provider[];

  // Remove any null results
  const validProviders = providersData.filter(Boolean);

  if (typeof uid === "string" && validProviders.length > 0) {
    return json({
      model: currentModel[uid]?.model || `${validProviders[0]?.name}@${validProviders[0]?.models[0]?.id}`,
      providers: validProviders
    });
  }

  return json({ success: false, error: "Invalid model or uid" }, { status: 400 });
};
