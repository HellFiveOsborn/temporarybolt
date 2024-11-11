import { env } from 'node:process';

export function getAPIKey(): Record<string, { apiKey: string; baseUrl: string }> {
  const providers: Record<string, { apiKey: string; baseUrl: string }> = {};

  // Coletar chaves de API não vazias e suas URLs correspondentes
  Object.entries(env).forEach(([key, value]) => {
    if (key.endsWith('_API_KEY') && value) {
      const providerName = key.replace('_API_KEY', '');

      // Verifica se o provedor já existe antes de adicionar
      if (!providers[providerName]) {
        providers[providerName] = {
          apiKey: value,
          baseUrl: env[`${providerName}_API_URL`] as string
        };
      }
    }
  });

  return providers;
}


