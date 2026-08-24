import Link from 'next/link';

export default function Home() {
  return (
    <div className="w-full px-10 py-20">
      <h1 className="text-3xl font-bold my-4">AI API learning sandbox</h1>

      <div className="flex-col flex gap-2">
        <Link href={'/gemini-text'} className=" text-lg cursor-pointer">
          1 - Gemini Text sandbox
        </Link>

        <Link href={'/recipe-extractor'} className=" text-lg cursor-pointer">
          2 - Recipe extractor structured output (gemini)
        </Link>

        <Link href={'/tools-calling'} className=" text-lg cursor-pointer">
          3 - Tools calling (gemini)
        </Link>
      </div>
    </div>
  );
}
