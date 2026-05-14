'use client';

import { useState } from 'react';
import UploadZone from '@/components/UploadZone';
import ChatWindow from '@/components/ChatWindow';
import ChatInput from '@/components/ChatInput';
import { chunkText, getRelevantChunks } from '@/lib/rag';

export default function Home() {
  const [chunks, setChunks]       = useState([]);
  const [fileName, setFileName]   = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [messages, setMessages]   = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [error, setError]         = useState('');

  // Step 1 — user uploads PDF → send to /api/parse → get back text → chunk it
  const handleUpload = async (file) => {
    setError('');
    setIsParsing(true);
    setMessages([]);
    setChunks([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to parse PDF.');

      // Split the full text into chunks for retrieval
      const textChunks = chunkText(data.text, 500, 50);

      setChunks(textChunks);
      setFileName(data.fileName);
      setPageCount(data.pages);

      // Add a welcome message from the assistant
      setMessages([{
        role: 'assistant',
        content: `I have read "${data.fileName}" (${data.pages} page${data.pages !== 1 ? 's' : ''}, ${textChunks.length} sections indexed). Ask me anything about this document!`,
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  // Step 2 — user asks question → find relevant chunks → send to /api/chat → display answer
  const handleSend = async (question) => {
    if (!question.trim() || chunks.length === 0) return;

    setError('');

    // Add user message immediately so UI feels responsive
    const newMessages = [...messages, { role: 'user', content: question }];
    setMessages(newMessages);
    setIsChatting(true);

    try {
      // Find the 4 most relevant chunks for this question
      const relevantChunks = getRelevantChunks(chunks, question, 4);

      // Build conversation history for Claude (exclude the welcome message)
      const history = newMessages
        .slice(1) // skip the welcome message
        .slice(-8) // keep last 8 messages max to avoid token limits
        .slice(0, -1) // exclude the message we just added (it goes as the final user turn)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: relevantChunks,
          history,
          fileName,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to get response.');

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠ ' + err.message },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleReset = () => {
    setChunks([]);
    setFileName('');
    setPageCount(0);
    setMessages([]);
    setError('');
  };

  const hasDocument = chunks.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              🤖 DocuChat AI
            </h1>
            <p className="text-xs text-gray-400">Powered by Claude · RAG Architecture</p>
          </div>
          <div className="flex items-center gap-3">
            {hasDocument && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">
                  📄 {fileName} · {pageCount}p · {chunks.length} chunks
                </span>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {!hasDocument ? (
          // Upload screen
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-gray-900 mb-3">
  Chat with any Document
</h2>
<p className="text-gray-500 text-lg">
  Upload PDF, Word, Excel, PowerPoint, CSV or Markdown — ask questions, get instant answers.
</p>
            </div>

            <UploadZone onUpload={handleUpload} isLoading={isParsing} />

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-5 py-3 text-sm">
                ⚠ {error}
              </div>
            )}

            {/* Example use cases */}
            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { icon: '📋', title: 'Research papers', desc: 'Extract key findings fast' },
                { icon: '💼', title: 'Job descriptions', desc: 'Match your skills instantly' },
                { icon: '📚', title: 'Study material', desc: 'Quiz yourself on any topic' },
              ].map(item => (
                <div key={item.title} className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className="font-medium text-gray-700 text-sm">{item.title}</p>
                  <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Chat screen
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col"
               style={{ height: 'calc(100vh - 160px)' }}>
            <ChatWindow messages={messages} />
            {error && (
              <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2 text-xs">
                ⚠ {error}
              </div>
            )}
            <ChatInput
              onSend={handleSend}
              isLoading={isChatting}
              disabled={!hasDocument}
            />
          </div>
        )}
      </div>
    </main>
  );
}
