import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { autoComplete, streamTextPromptEnhancer } from '~/lib/.server/llm/stream-text';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
    return autocompleteAction(args);
}

async function autocompleteAction({ context, request }: ActionFunctionArgs) {
    const { prefix, suffix, language } = await request.json() as any;

    try {
        const cookieHeader = request.headers.get("Cookie");

        // Analyzing cookies.
        const cookies: { [key: string]: string } = {};
        if (cookieHeader) {
            cookieHeader.split('; ').forEach(cookie => {
                const [name, value] = cookie.split('=');
                cookies[name] = decodeURIComponent(value);
            });
        }

        const result = await autoComplete(cookies["uid"], prefix, suffix, language, cookies["autocompleteModel"]);

        const transformStream = new TransformStream({
            transform(chunk, controller) {
                const processedChunk = decoder
                    .decode(chunk)
                    .split('\n')
                    .filter((line) => line !== '')
                    .map(parseStreamPart)
                    .map((part) => {
                        // Certifique-se de que part.value seja uma string
                        if (typeof part.value === 'string') {
                            return part.value;
                        } else {
                            // Se part.value não for uma string, converta-o em string
                            return ''; //JSON.stringify(part.value);
                        }
                    })
                    .join('');

                controller.enqueue(encoder.encode(processedChunk));
            },
        });

        const transformedStream = result.toAIStream().pipeThrough(transformStream);

        return new StreamingTextResponse(transformedStream);
    } catch (error) {
        console.log(error);

        throw new Response(null, {
            status: 500,
            statusText: 'Internal Server Error',
        });
    }
}