'use client';

import { UIMessage, useChat, useCompletion } from '@ai-sdk/react';
import { FinishReason } from 'ai';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remark_GFM from 'remark-gfm';

type ChatHistory = {
  chatId: string | null;
  title: string;
  history: UIMessage[];
};

type OnFinishOptions = {
  message: UIMessage;
  messages: UIMessage[];
  isAbort: boolean;
  isDisconnect: boolean;
  isError: boolean;
  finishReason?: FinishReason;
};

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, setMessages, sendMessage, status, stop } = useChat({
    onFinish: finishHandler,
  });

  const { setInput: setCompletionInput, complete } = useCompletion({
    api: '/api/completion',
  });

  const searchParams = useSearchParams();
  const router = useRouter();
  const chatId = searchParams.get('chatId');

  const [allChatsHistory, setAllChatsHistory] = useState<ChatHistory[]>([]);
  const [files, setFiles] = useState<FileList>();

  const genNewChatId = useCallback(() => {
    router.replace(`?chatId=${crypto.randomUUID()}`);
  }, [router]);
  useEffect(() => {
    if (!chatId) genNewChatId();
  }, [chatId, genNewChatId]);

  useEffect(() => {
    if (!chatId) return;

    const allChatsHistoryLS: ChatHistory[] = JSON.parse(
      localStorage.getItem('all-chats-history-sdk') ?? '[]',
    );

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllChatsHistory(allChatsHistoryLS);

    const currHistory =
      allChatsHistoryLS.find((e) => e.chatId === chatId)?.history ?? [];

    setMessages(currHistory);
  }, [chatId, setMessages]);

  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e?.target.files;

    if (files) setFiles(files);
  };

  const submitHandler = () => {
    sendMessage({ text: input, files });
    setInput('');
    setFiles(undefined);
  };

  async function finishHandler(options: OnFinishOptions) {
    if (!options.isError) {
      let newTitle = null;
      if (!allChatsHistory.find((c) => c.chatId === chatId)?.title) {
        const inputForCompletion = options.messages
          .map((p) =>
            p.parts.map((i) =>
              i.type === 'text' ? p.role + ' : ' + i.text : '',
            ),
          )
          .toString();

        newTitle = await complete(inputForCompletion);
      }

      const setHistoryData: ChatHistory[] = allChatsHistory.find(
        (chat) => chat.chatId == chatId,
      )
        ? allChatsHistory.map((chat) =>
            chat.chatId == chatId
              ? {
                  ...chat,
                  history: options.messages,
                }
              : chat,
          )
        : [
            ...allChatsHistory,
            {
              chatId,
              title: newTitle || '--',
              history: options.messages,
            },
          ];

      localStorage.setItem(
        'all-chats-history-sdk',
        JSON.stringify(setHistoryData),
      );

      setAllChatsHistory(setHistoryData);
    }
  }

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
              stop();
              setMessages([]);
              setInput('');
              setCompletionInput('');
              setFiles(undefined);
              genNewChatId();
            }}
            className="w-full cursor-pointer rounded-md bg-zinc-800 py-2 hover:bg-zinc-700"
          >
            + New Chat
          </button>
        </div>

        {/* Chat history  */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {allChatsHistory.map((chat) => (
            <button
              key={chat.chatId}
              className="w-full cursor-pointer truncate rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-800"
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
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-4xl space-y-5 wrap-break-word">
            {messages.map(
              (message: UIMessage, index) =>
                (message.role === 'assistant' || message.role === 'user') && (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-100'
                      }`}
                    >
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case 'text':
                            return (
                              <Markdown
                                key={`${message.id}-${i}`}
                                remarkPlugins={[remark_GFM]}
                              >
                                {part.text}
                              </Markdown>
                            );
                        }
                      })}
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
              disabled={status === 'submitted' || status === 'streaming'}
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitHandler();
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

                <input
                  ref={fileInput}
                  disabled={status === 'submitted' || status === 'streaming'}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              {status === 'submitted' || status === 'streaming' ? (
                <button
                  onClick={() => stop()}
                  className="rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-500"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => submitHandler()}
                  className="rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-500"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
