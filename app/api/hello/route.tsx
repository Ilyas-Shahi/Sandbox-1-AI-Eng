import { ai } from '@/lib/gemini';

export async function GET() {
  const interaction = await ai.interactions.create({
    model: 'gemini-3.1-flash-lite',
    input: 'Explain how AI works in a few words',
  });

  return Response.json({ message: interaction.output_text });
}
