'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type ChatHistory = {
  chatId: string | null;
  title: string;
  history: MessageMT[];
};

type Message = {
  role: 'user_input' | 'model_output' | 'model' | 'user';
  content: [{ type: string; text: string }];
};

type MessageMT = {
  type: 'user_input' | 'model_output' | 'model' | 'user';
  content: [{ type: string; text: string }];
};

const MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemma-4-31b-it',
];

export default function ChatUI() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatId = searchParams.get('chatId');

  const genNewChatId = useCallback(() => {
    router.replace(`?chatId=${crypto.randomUUID()}`);
  }, [router]);
  useEffect(() => {
    if (!chatId) genNewChatId();
  }, [chatId, genNewChatId]);

  const [allChatsHistory, setAllChatsHistory] = useState<ChatHistory[]>([]);

  const [messagesHistory, setMessagesHistory] = useState<MessageMT[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODELS[0]);

  useEffect(() => {
    if (!chatId) return;

    const allChatsHistoryLS: ChatHistory[] = JSON.parse(
      localStorage.getItem('all-chats-history') ?? '[]',
    );

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllChatsHistory(allChatsHistoryLS);

    const currHistory =
      allChatsHistoryLS.find((e) => e.chatId === chatId)?.history ?? [];

    setMessagesHistory(currHistory);
  }, [chatId]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesHistory]);

  //  TODO: =========== Call your backend here.
  const sendMessage = async () => {
    if (!input.trim()) return;

    const newTurn: MessageMT = {
      type: 'user_input',
      content: [{ type: 'text', text: input }],
    };

    setMessagesHistory((prev) => [...prev, newTurn]);

    setInput('');
    inputRef.current?.setAttribute('enabled', 'false');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            model,
            store: false,
            input: [...messagesHistory, newTurn],
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        const interaction = data.interaction;

        setMessagesHistory((prev) => [...prev, ...interaction.steps]);

        const newHistory = [...messagesHistory, newTurn, ...interaction.steps];
        const setHistoryData: ChatHistory[] = allChatsHistory.find(
          (chat) => chat.chatId == chatId,
        )
          ? allChatsHistory.map((chat) =>
              chat.chatId == chatId
                ? {
                    ...chat,
                    history: newHistory,
                  }
                : chat,
            )
          : [
              ...allChatsHistory,
              {
                chatId,
                title: newTurn.content[0].text.trim(),
                history: newHistory,
              },
            ];

        localStorage.setItem(
          'all-chats-history',
          JSON.stringify(setHistoryData),
        );
        setAllChatsHistory(setHistoryData);
      } else {
        throw new Error(data.interaction);
      }
    } catch (error) {
      console.error(error);
    } finally {
      inputRef.current?.setAttribute('enabled', 'true');
    }
  };

  console.log('all history: ', allChatsHistory);
  console.log('history: ', messagesHistory);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-72 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <button
            onClick={() => {
              setMessagesHistory([]);
              setInput('');
              genNewChatId();
            }}
            className="w-full rounded-md bg-zinc-800 py-2 hover:bg-zinc-700"
          >
            + New Chat
          </button>
        </div>

        {/* Chat history  */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {allChatsHistory.map((chat) => (
            <button
              key={chat.chatId}
              className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-800"
              onClick={() => router.replace(`?chatId=${chat.chatId}`)}
            >
              {chat.title}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <h1 className="font-semibold">My Chatbot</h1>

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

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-4xl space-y-5">
            {messagesHistory.map(
              (message: MessageMT, index) =>
                (message.type === 'model_output' ||
                  message.type === 'user_input') && (
                  <div
                    key={message.type + index}
                    className={`flex ${
                      message.type === 'user_input'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl px-4 py-3 ${
                        message.type === 'user_input'
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-100'
                      }`}
                    >
                      {message.content[0].text}
                    </div>
                  </div>
                ),
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        {/* Composer */}
        <footer className="border-t border-zinc-800 bg-zinc-900 p-4">
          <div className="mx-auto max-w-4xl rounded-xl border border-zinc-700 bg-zinc-800 p-3">
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask anything..."
              className="w-full resize-none bg-transparent outline-none placeholder:text-zinc-500"
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => fileInput.current?.click()}
                  className="rounded-md border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-700"
                >
                  📎
                </button>

                <input ref={fileInput} type="file" hidden />
              </div>

              <button
                onClick={sendMessage}
                className="rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-500"
              >
                Send
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
