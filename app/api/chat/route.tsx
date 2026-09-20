import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  tool,
  isStepCount,
} from 'ai';
import { z } from 'zod';
import { toolDefs } from '@/lib/toolDefsGem';

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
      model: 'alibaba/qwen3.7-flash',
      messages: await convertToModelMessages(messages),
      stopWhen: isStepCount(5),
      tools: {
        weather: tool({
          description: 'Get the weather in a location (celsius)',
          inputSchema: z.object({
            location: z
              .string()
              .describe('The location to get the weather for'),
            latitude: z.string().describe('The latitude of the city/location'),
            longitude: z
              .string()
              .describe('The longitude of the city/location'),
          }),
          execute: toolDefs.get_weather,
        }),
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ success: false, error });
  }
}
