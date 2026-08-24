import { ai } from '@/lib/gemini';
import { ApiError } from '@google/genai';

type ToolCalls = {
  type: string;
  id: string;
  name: string;
  arguments: object;
};
interface ToolResult {
  type: string;
  call_id: string;
  name: string;
  result: { type: string; text: string }[];
}

const weatherTool = {
  name: 'get_weather',
  description: 'Gets the weather for a given location.',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'The city and state' },
      latitude: {
        type: 'string',
        description: 'The latitude of the city/location',
      },
      longitude: {
        type: 'string',
        description: 'The longitude of the city/location',
      },
    },
    required: ['location', 'latitude', 'longitude'],
  },
};

// API for getting current weather
async function get_weather(toolArgs: Record<string, string>) {
  const { location, latitude, longitude } = toolArgs;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
    );

    const resData = await res.json();

    console.log('get_weather', res.status, resData?.current.temperature_2m);

    if (res.status === 200) {
      return {
        success: true,
        data: {
          location,
          temperature: resData.current.temperature_2m,
          unit: resData.current_units.temperature_2m,
        },
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    return { success: false, data: error };
  }
}

const toolDefs = {
  get_weather,
};

export async function POST(request: Request) {
  const data = await request.json();
  const params = data.params;

  try {
    if (!params) throw new Error('No request params.');

    const { model, input } = params;

    // create gemini stream
    const geminiStream = await ai.interactions.create({
      model,
      input,
      tools: [{ type: 'function', ...weatherTool }],
      stream: true,
      store: false,
    });

    const currentCalls = new Map();
    let toolCalls: ToolCalls[] | never[] = [];
    const toolResults: ToolResult[] = [];
    const chatSteps = [...input];

    // create a stream for this api to send data incremental
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // loop over the events from the gemini stream
          for await (const event of geminiStream) {
            const evType = event.event_type;

            console.log('------------------ EVENT: _______ ', event);

            // ---- pasted from google docs

            if (evType === 'step.start') {
              if (event.step.type === 'function_call') {
                // record that the request has a function call
                currentCalls.set(event.index, {
                  id: event.step.id,
                  name: event.step.name,
                  arguments: '',
                });
                console.log('_______ current calls', currentCalls);

                if (
                  event.step.arguments &&
                  Object.keys(event.step.arguments).length !== 0
                ) {
                  console.log(
                    '_______ event.step.arguments',
                    event.step.arguments,
                  );
                  if (typeof event.step.arguments === 'object') {
                    currentCalls.get(event.index).arguments = JSON.stringify(
                      event.step.arguments,
                    );
                  } else {
                    currentCalls.get(event.index).arguments =
                      event.step.arguments;
                  }
                }
              }
            } else if (evType === 'step.delta') {
              // call function
              //
              if (event.delta.type === 'arguments_delta') {
                if (currentCalls.has(event.index)) {
                  console.log(
                    '_______ currentCalls.has(event.index)',
                    currentCalls,
                  );
                  currentCalls.get(event.index).arguments +=
                    event.delta.arguments;
                }

                // call function
              } else if (event.delta.type === 'text') {
                // process.stdout.write(event.delta.text);
                chatSteps.push(event.delta);
                controller.enqueue(event.delta.text);
              }
            } else if (evType === 'interaction.completed') {
              toolCalls = Array.from(currentCalls.values()).map((call) => ({
                type: 'function_call',
                id: call.id,
                name: call.name,
                arguments: call.arguments ? JSON.parse(call.arguments) : {},
              }));

              console.log('_______ currentCalls', currentCalls);
              console.log('_______ toolCalls', toolCalls);
              console.log('_______ toolResults', toolResults);
            }
          }

          if (
            toolCalls.length &&
            toolCalls.find((tl) => tl.type === 'function_call')
          ) {
            for (const tool of toolCalls) {
              chatSteps.push({
                type: 'function_call',
                id: tool.id,
                name: tool.name,
                arguments: tool.arguments,
              });
              // @ts-expect-error idk
              const toolResult = await toolDefs[tool.name](tool.arguments);

              console.log('toolResult1', toolResult);
              if (toolResult.success) {
                toolResults.push({
                  type: 'function_result',
                  name: tool.name,
                  call_id: tool.id,
                  result: [
                    { type: 'text', text: JSON.stringify(toolResult.data) },
                  ],
                });

                // send results back to modal and/or stream
                if (toolCalls.length === toolResults.length) {
                  try {
                    console.log('input for final interaction: ', [
                      ...chatSteps,
                      ...toolResults,
                    ]);
                    const finalInteraction = await ai.interactions.create({
                      model,
                      // input: [...chatSteps, ...toolResults],
                      input: JSON.stringify([...chatSteps, ...toolResults]),
                      tools: [{ type: 'function', ...weatherTool }],
                      stream: true,
                      store: false,
                    });
                    for await (const eventFin of finalInteraction) {
                      if (
                        eventFin.event_type === 'step.delta' &&
                        eventFin.delta.type === 'text'
                      ) {
                        controller.enqueue(eventFin.delta.text);
                      }

                      console.log(
                        '------------ finalInteraction event: ',
                        eventFin,
                      );
                    }

                    controller.close();
                  } catch (error) {
                    console.log('error on finalInteraction: ', error);
                    controller.close();
                  }
                } else {
                  controller.close();
                  console.log(
                    'toolCalls.length === toolResults.length',
                    toolCalls.length === toolResults.length,
                  );
                }
              } else {
                controller.close();
                console.log('toolResult.success', toolResult.success);
              }
            }
          } else {
            controller.close();
            console.log('issue in: toolCalls.length or toolCalls.find...');
          }
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
