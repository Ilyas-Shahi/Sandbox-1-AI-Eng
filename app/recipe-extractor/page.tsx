'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import * as zod from 'zod';

type RecipesHistory = {
  recipeId: string | null;
  title: string;
  input: string;
  recipe: RecipeType;
};

const MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemma-4-31b-it',
];

const recipeJSONSchema = {
  type: 'object',
  properties: {
    recipe_name: {
      type: 'string',
      description: 'The name of the recipe.',
    },
    prep_time_minutes: {
      type: 'integer',
      description: 'Optional time in minutes to prepare the recipe.',
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the ingredient.' },
          quantity: {
            type: 'string',
            description: 'Quantity of the ingredient, including units.',
          },
        },
        required: ['name', 'quantity'],
      },
    },
    instructions: {
      type: 'array',
      items: { type: 'string' },
    },
    is_valid_recipe: {
      type: 'boolean',
      description: 'Check if the input/output are valid recipes.',
    },
  },
  required: [
    'recipe_name',
    'ingredients',
    'instructions',
    'prep_time_minutes',
    'is_valid_recipe',
  ],
};

type RecipeType = {
  ingredients: {
    name: string;
    quantity: string;
  }[];
  instructions: string[];
  recipe_name: string;
  prep_time_minutes: string;
  is_valid_recipe: boolean;
};

// @ts-expect-error fromJSONSchema experimental
const recipeSchema = zod.fromJSONSchema(recipeJSONSchema);

export default function RecipeExtractorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const recipeId = searchParams.get('recipeId');

  const genNewRecipeId = useCallback(() => {
    router.replace(`?recipeId=${crypto.randomUUID()}`);
  }, [router]);
  useEffect(() => {
    if (!recipeId) genNewRecipeId();
  }, [recipeId, genNewRecipeId]);

  const [recipe, setRecipe] = useState<RecipeType | null>();
  const [recipesHistory, setRecipesHistory] = useState<RecipesHistory[]>([]);

  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODELS[0]);

  useEffect(() => {
    if (!recipeId) return;

    const allChatsHistoryLS: RecipesHistory[] = JSON.parse(
      localStorage.getItem('all-recipes-history') ?? '[]',
    );

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecipesHistory(allChatsHistoryLS);

    const currHistory =
      allChatsHistoryLS.find((e) => e.recipeId === recipeId) ?? null;

    setRecipe(currHistory?.recipe);
    setInput(currHistory?.input ?? '');
  }, [recipeId]);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  //  TODO: =========== Call your backend here.
  const sendMessage = async () => {
    if (!input.trim()) return;

    inputRef.current?.setAttribute('disabled', 'true');

    try {
      // NON streaming logic
      const response = await fetch('/api/chat-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            model,
            // store: false,
            input: input,
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: recipeJSONSchema,
            },
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        const interaction = data.interaction;

        // @ts-expect-error zod
        const recipeResult: RecipeType = recipeSchema.parse(
          JSON.parse(interaction.output_text),
        );

        setRecipe(recipeResult);

        const newHistory: RecipesHistory[] = [
          ...recipesHistory,
          {
            recipeId,
            title: recipeResult.recipe_name,
            input,
            recipe: recipeResult,
          },
        ];

        localStorage.setItem('all-recipes-history', JSON.stringify(newHistory));
        setRecipesHistory(newHistory);
      } else {
        throw new Error(data.interaction);
      }
    } catch (error) {
      console.error(error);
      inputRef.current?.removeAttribute('disabled');
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-72 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        <div className="p-4 border-b flex gap-3 items-center border-zinc-800">
          <Link
            className="cursor-pointer rounded-md bg-zinc-800 px-4 py-1 hover:bg-zinc-700"
            href={'/'}
          >
            Home
          </Link>
          <button
            onClick={() => {
              setInput('');
              genNewRecipeId();
            }}
            className="w-full cursor-pointer rounded-md bg-zinc-800 py-2 hover:bg-zinc-700"
          >
            + New Recipe
          </button>
        </div>

        {/* Chat history  */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {recipesHistory.map((rcp) => (
            <button
              key={rcp.recipeId}
              className="w-full cursor-pointer truncate rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-800"
              onClick={() => router.replace(`?recipeId=${rcp.recipeId}`)}
            >
              {rcp.title}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <h1 className="font-semibold">Recipe Extractor</h1>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          >
            {MODELS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </header>

        {/* Recipe */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-4xl space-y-5 wrap-break-word">
            <div className={`flex justify-end  flex-col items-center gap-10`}>
              {recipe && (
                <div
                  className={` rounded-2xl px-4 py-3 bg-blue-600 text-white`}
                >
                  {input}
                </div>
              )}

              <div className={`flex justify-start`}>
                {recipe &&
                  (recipe.is_valid_recipe ? (
                    <div
                      className={`w-full rounded-2xl px-4 py-3 bg-zinc-800 text-zinc-100`}
                    >
                      <div className="rounded-xl border bg-zinc-900 p-5 space-y-6">
                        <div>
                          <h2 className="text-2xl font-bold">
                            {recipe.recipe_name}
                          </h2>

                          <p className="mt-2 text-sm text-zinc-400">
                            ⏱️ {recipe.prep_time_minutes} min
                          </p>
                        </div>

                        <section>
                          <h3 className="mb-3 text-lg font-semibold">
                            Ingredients
                          </h3>

                          <ul className="space-y-2">
                            {recipe.ingredients.map((ingredient) => (
                              <li
                                key={ingredient.name}
                                className="flex justify-between gap-4 border-b border-zinc-800 pb-2"
                              >
                                <span>{ingredient.name}</span>
                                <span className="text-zinc-400">
                                  {ingredient.quantity}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>

                        <section>
                          <h3 className="mb-3 text-lg font-semibold">
                            Instructions
                          </h3>

                          <ol className="space-y-4 list-decimal pl-5">
                            {recipe.instructions.map((instruction) => (
                              <li key={instruction}>{instruction}</li>
                            ))}
                          </ol>
                        </section>
                      </div>
                    </div>
                  ) : (
                    <div>Invalid Recipe</div>
                  ))}
              </div>

              <div ref={bottomRef} />
            </div>
          </div>
        </main>

        {/* Composer */}
        {!recipe && (
          <footer className="border-t border-zinc-800 bg-zinc-900 p-4">
            <div className="mx-auto max-w-4xl rounded-xl border border-zinc-700 bg-zinc-800 p-3">
              <textarea
                ref={inputRef}
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about any recipe..."
                className="w-full resize-none bg-transparent outline-none placeholder:text-zinc-500"
              />

              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={sendMessage}
                  className="rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-500"
                >
                  Send
                </button>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
