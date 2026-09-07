import { ai } from '@/lib/gemini';
import {
  toolDefs,
  weatherToolDec,
  writeMeetingToolDec,
  readMeetingToolDec,
} from '@/lib/toolDefsGem';
import { ApiError } from '@google/genai';

type ToolCalls = {
  type: string;
  id: string;
  name: string;
  arguments: object;
  result: ToolResult | null;
};
interface ToolResult {
  type: string;
  call_id: string;
  name: string;
  result: { type: string; text: string }[];
}

export async function POST(request: Request) {
  const data = await request.json();
  const params = data.params;

  try {
    if (!params) throw new Error('No request params.');

    const { model, input } = params;

    const toolCalls = new Map<string, ToolCalls>();
    let allToolResults: ToolResult[] = [];
    const chatSteps = [...input];
    let toolsCalled = 0;

    async function handleGeminiStream(
      controller: ReadableStreamDefaultController,
    ) {
      const currentCalls = new Map();

      // create gemini stream
      const geminiStream = await ai.interactions.create({
        model,
        input: JSON.stringify([...chatSteps, ...allToolResults]),
        tools: [
          { type: 'function', ...weatherToolDec },
          { type: 'function', ...writeMeetingToolDec },
          { type: 'function', ...readMeetingToolDec },
        ],
        stream: true,
        store: false,
      });

      // loop over the events from the gemini stream
      for await (const event of geminiStream) {
        const evType = event.event_type;
        // console.log('------------------ EVENT: _______ ', event);

        if (evType === 'step.start') {
          if (event.step.type === 'function_call') {
            // record that the request has a function call
            currentCalls.set(event.index, {
              id: event.step.id,
              name: event.step.name,
              arguments: '',
            });

            if (
              event.step.arguments &&
              Object.keys(event.step.arguments).length !== 0
            ) {
              if (typeof event.step.arguments === 'object') {
                currentCalls.get(event.index).arguments = JSON.stringify(
                  event.step.arguments,
                );
              } else {
                currentCalls.get(event.index).arguments = event.step.arguments;
              }
            }
          }
        } else if (evType === 'step.delta') {
          // if arguments for a function record them else if text enqueue it
          if (event.delta.type === 'arguments_delta') {
            if (currentCalls.has(event.index)) {
              currentCalls.get(event.index).arguments += event.delta.arguments;
            }
          } else if (event.delta.type === 'text') {
            chatSteps.push(event.delta);
            controller.enqueue(event.delta.text);
          }
        } else if (evType === 'interaction.completed') {
          Array.from(currentCalls.values()).map((call) => {
            toolCalls.set(call.id, {
              type: 'function_call',
              id: call.id,
              name: call.name,
              arguments: call.arguments ? JSON.parse(call.arguments) : {},
              result: null,
            });
          });

          // Check if there are tools to be called.
          if (
            toolCalls.size &&
            [...toolCalls].some((tl) => tl[1].type === 'function_call')
          ) {
            for (const [toolId, tool] of toolCalls) {
              if (tool.result === null) {
                chatSteps.push({
                  type: 'function_call',
                  id: tool.id,
                  name: tool.name,
                  arguments: tool.arguments,
                });
                // @ts-expect-error idk
                const toolResult = await toolDefs[tool.name](tool.arguments);
                toolsCalled++;

                if (toolResult.success) {
                  toolCalls.set(toolId, {
                    ...tool,
                    result: {
                      type: 'function_result',
                      name: tool.name,
                      call_id: tool.id,
                      result: [
                        { type: 'text', text: JSON.stringify(toolResult.data) },
                      ],
                    },
                  });

                  allToolResults = Array.from(toolCalls.values())
                    .map((tool) => tool.result)
                    .filter((res) => res !== null);

                  // send results back to modal and/or stream
                  if (
                    event.interaction.status === 'requires_action' &&
                    toolsCalled < 20
                  ) {
                    try {
                      await handleGeminiStream(controller);
                    } catch (error) {
                      controller.close();
                    }
                  }
                }
              }
            }
          }

          controller.close();
        }
      }
    }

    // create a stream for this api to send data incremental
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await handleGeminiStream(controller);
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
