'use client';

import { useEffect, useRef } from 'react';

export default function ChatWindow({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
        <div className="text-4xl mb-3">💬</div>
        <p className="text-lg font-medium text-gray-500">Ask anything about your document</p>
        <p className="text-sm mt-1">Try: "Summarize this document" or "What are the main points?"</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-md'
                : 'bg-white border border-gray-100 text-gray-700 shadow-sm rounded-bl-md'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-1.5 mb-2 text-violet-500 font-medium text-xs">
                <span>🤖</span> DocuChat AI
              </div>
            )}
            {msg.content}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}