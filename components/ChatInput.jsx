'use client';

import { useState } from 'react';

export default function ChatInput({ onSend, isLoading, disabled }) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim() || isLoading || disabled) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <div className="border-t border-gray-100 p-4 bg-white">
      <div className="flex gap-3 items-end">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={disabled ? 'Upload a PDF to start chatting...' : 'Ask a question about your document...'}
          disabled={disabled || isLoading}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition-all"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading || disabled}
          className="px-5 py-3 bg-violet-600 text-white rounded-xl font-medium text-sm hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Thinking...
            </span>
          ) : 'Send →'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}