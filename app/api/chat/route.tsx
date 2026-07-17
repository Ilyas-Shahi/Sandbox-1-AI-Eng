import { ai } from '@/lib/gemini';

export async function POST(request: Request) {
  const data = await request.json();
  const params = data.params;

  console.log(params);

  try {
    if (!params) throw new Error('No Request params');

    const interaction = await ai.interactions.create(params);
    console.log('interaction steps', interaction.steps);

    return Response.json({ success: true, interaction });
  } catch (error) {
    console.log('error ');
    return Response.json({ success: false, interaction: error });
  }
}
