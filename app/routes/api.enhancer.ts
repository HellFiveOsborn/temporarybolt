import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { streamTextPromptEnhancer } from '~/lib/.server/llm/stream-text';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ request }: ActionFunctionArgs) {
  const { message: prompt } = await request.json<{ message: string }>();

  try {
    const cookieHeader = request.headers.get("Cookie");
    const cookies = parseCookies(cookieHeader);

    const result = await streamTextPromptEnhancer(cookies["uid"], prompt, cookies["enhancerModel"]);

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const processedChunk = decoder
          .decode(chunk)
          .split('\n')
          .filter((line) => line !== '')
          .map(parseStreamPart)
          .map((part) => {
            if (typeof part.value === 'string') {
              console.log('String', part.value);
              return part.value;
            } else {
              console.log('Object', JSON.stringify(part.value));
              return '';
            }
          })
          .join('');

        controller.enqueue(encoder.encode(processedChunk));
      },
    });

    const transformedStream = result.toAIStream().pipeThrough(transformStream);

    return new StreamingTextResponse(transformedStream);
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}

function parseCookies(cookieHeader: string | null): { [key: string]: string } {
  const cookies: { [key: string]: string } = {};
  if (cookieHeader) {
    cookieHeader.split('; ').forEach(cookie => {
      const [name, value] = cookie.split('=');
      cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}
