import { ai } from '@/lib/gemini';
import { ApiError } from '@google/genai';

export async function POST(request: Request) {
  const data = await request.json();
  const params = data.params;

  try {
    if (!params) throw new Error('No request params.');

    const { model, input } = params;

    const geminiStream = await ai.interactions.create({
      model,
      input,
      stream: true,
      store: false,
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of geminiStream) {
            if (
              event.event_type === 'step.delta' &&
              event.delta.type === 'text'
            ) {
              controller.enqueue(event.delta.text);
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream);
  } catch (error) {
    return Response.json(
      { success: false, error },
      { status: (error as ApiError)?.status ?? 500 },
    );
  }
}
