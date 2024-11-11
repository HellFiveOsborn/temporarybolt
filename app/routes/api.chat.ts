import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import type { ModelType } from '~/lib/.server/llm/model';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

type experimental_attachments = {
  name: string;
  url: string;
  contentType: string;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages, model, experimental_attachments } = await request.json<{ messages: Messages, model: string, experimental_attachments?: experimental_attachments[] }>();

  const stream = new SwitchableStream();

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

    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason }) => {
        if (finishReason !== 'length') return stream.close();
        if (stream.switches >= MAX_RESPONSE_SEGMENTS) throw Error('Cannot continue message: Maximum segments reached');
        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

        console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        const result = await streamText(cookies["uid"], messages, model, options);

        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(cookies["uid"], messages, model, options);

    stream.switchSource(result.toAIStream());

    return new Response(stream.readable, {
      status: 200,
      headers: { contentType: 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error(error);
    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
