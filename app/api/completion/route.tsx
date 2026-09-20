import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const result = streamText({
    model: 'alibaba/qwen3.7-flash',
    prompt,
    maxOutputTokens: 50,
    instructions:
      'You will get a input and have to summarize into a 5 word for the chat title/heading. Output Max length: 5 words.',
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
