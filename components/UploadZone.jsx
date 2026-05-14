'use client';

import { useRef, useState } from 'react';

export default function UploadZone({ onUpload, isLoading }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }
    onUpload(file);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
        dragOver
          ? 'border-violet-400 bg-violet-50'
          : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <div className="text-5xl mb-4">📄</div>
      <p className="text-xl font-semibold text-gray-700 mb-2">
        {isLoading ? 'Reading your document...' : 'Drop your PDF here'}
      </p>
      <p className="text-gray-400 text-sm">
        {isLoading ? 'Extracting text and building index...' : 'or click to browse — any PDF up to 10MB'}
      </p>
      {isLoading && (
        <div className="mt-6 flex justify-center">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}