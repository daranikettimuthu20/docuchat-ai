# 🤖 DocuChat AI — RAG-Powered PDF Chatbot

> Upload any PDF. Ask questions in plain English. Get instant answers — powered by Claude AI and a custom-built RAG pipeline.

**🔗 Live Demo:** [docuchat-ai-w86t.vercel.app](https://docuchat-ai-w86t.vercel.app)
**👨‍💻 Built by:** [Darani Kettimuthu](https://github.com/daranikettimuthu20)

---

## 📸 Preview

| Upload Screen | Chat Interface |
|---|---|
| Drop any PDF onto the upload zone | Ask natural language questions and get answers pulled directly from your document |

---

## 🧠 What Is RAG?

RAG stands for **Retrieval Augmented Generation**. Instead of sending an entire PDF to Claude (which hits context limits fast), a retrieval layer first finds only the most relevant sections, then sends those to the AI for answering.

```
User uploads PDF
      ↓
Extract full text (unpdf)
      ↓
Split into overlapping chunks (500 words, 50 word overlap)
      ↓
User asks a question
      ↓
TF-IDF scoring ranks all chunks by relevance
      ↓
Top 4 chunks selected
      ↓
Chunks + question + history → Claude Haiku API
      ↓
Answer returned strictly from document
```

No hallucination. No making things up. Answers come only from your document.

---

## ⚙️ Full Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Framework with file-based routing |
| React | UI components with hooks |
| Tailwind CSS | Utility-first styling |
| Custom `UploadZone` component | Drag-and-drop PDF upload using `useRef` |
| Custom `ChatWindow` component | Real-time message display with auto-scroll |
| Custom `ChatInput` component | Message input with Enter-to-send |

### Backend (Next.js API Routes)
| Route | What it does |
|---|---|
| `POST /api/parse` | Receives PDF via FormData, extracts text using unpdf, returns raw text + page count |
| `POST /api/chat` | Receives question + context chunks + history, calls Claude API, returns answer |

### AI Layer
| Technology | Details |
|---|---|
| Anthropic Claude Haiku | `claude-haiku-4-5-20251001` via `@anthropic-ai/sdk` |
| System prompt engineering | Prevents hallucination — Claude instructed to say "not found" rather than guess |
| Multi-turn conversation | Last 8 messages passed per request for natural follow-up questions |
| Max output tokens | 1024 per response |

### RAG Layer (built from scratch — no LangChain, no vector DB)
| Component | Details |
|---|---|
| `chunkText()` | Splits text on whitespace into 500-word chunks with 50-word overlap |
| `getRelevantChunks()` | TF-IDF scoring — ranks every chunk by relevance to the query |
| Top-K retrieval | K=4 chunks selected per question |
| Noise filter | Chunks under 50 characters are discarded |

### Deployment
| Tool | Purpose |
|---|---|
| GitHub | Version control and source hosting |
| Vercel | Automatic CI/CD — deploys on every push to `main` |
| Vercel Environment Variables | Secure API key management |

---

## 💡 Key Engineering Decisions

**✅ No vector database**
TF-IDF retrieval is fast enough for single-document RAG and keeps the architecture free to run. No Pinecone, no Weaviate, no cost.

**✅ Overlap chunking**
50-word overlap between chunks means answers that span a page boundary are never cut off mid-sentence. Without overlap, a key fact split across two chunks would be missed.

**✅ Server-side PDF parsing**
PDF parsing runs inside a Next.js API route (`/api/parse`), not in the browser. This means large files do not crash the client and the parsing library never ships to the user's device.

**✅ Conversation memory**
The last 8 turns of history are passed to Claude on every request. This means follow-up questions like "Tell me more about that" or "Give me an example" work naturally.

**✅ Hallucination prevention**
The system prompt explicitly instructs Claude: *"If the answer is not in the document, say exactly: I couldn't find information about that in this document."* Claude never makes up an answer.

**✅ useRef for file input**
The file picker uses `useRef` instead of `document.getElementById`. In React, `getElementById` is unreliable because React controls the DOM. `useRef` gives a direct, guaranteed reference to the input element.

---

## 📂 Project Structure

```
docuchat-ai/
├── app/
│   ├── page.jsx              ← Main page — upload screen + chat screen
│   ├── layout.jsx            ← Root layout with metadata
│   ├── globals.css           ← Global Tailwind styles
│   └── api/
│       ├── parse/
│       │   └── route.js      ← PDF parsing API route
│       └── chat/
│           └── route.js      ← Claude chat API route
├── components/
│   ├── UploadZone.jsx        ← Drag-and-drop file upload component
│   ├── ChatWindow.jsx        ← Chat messages display with auto-scroll
│   └── ChatInput.jsx         ← Message input bar with keyboard shortcuts
├── lib/
│   └── rag.js                ← chunkText() and getRelevantChunks() — the RAG core
├── .env.local                ← API key (never committed)
├── .gitignore
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js v18 or higher
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/daranikettimuthu20/docuchat-ai.git
cd docuchat-ai
```

**2. Install dependencies**
```bash
npm install
```

**3. Create your environment file**
```bash
# Create .env.local in the project root
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**4. Run the development server**
```bash
npm run dev
```

**5. Open in browser**
```
http://localhost:3000
```

**6. Test it**
- Upload your resume PDF
- Ask: *"Summarize this document in 5 bullet points"*
- Ask: *"What are the main skills listed?"*
- Ask: *"What certifications does this person have?"*

---

## ☁️ Deploy to Vercel

**1. Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

**2. Import on Vercel**
- Go to [vercel.com](https://vercel.com)
- Click New Project → Import your repository
- Click Deploy

**3. Add environment variable**
- Go to Settings → Environment Variables
- Add: `ANTHROPIC_API_KEY` = your key
- Click Save → Redeploy

Your app is now live.

---

## 📋 Example Use Cases

| Use case | Upload | Ask |
|---|---|---|
| Research papers | Academic PDF | "What are the key findings?" |
| Job applications | Job description PDF | "What skills am I missing?" |
| Resume review | Your resume | "Summarize my experience in 5 bullets" |
| Study material | Lecture notes | "Quiz me on the main concepts" |
| Legal documents | Contract PDF | "What are the key obligations?" |
| Technical docs | API documentation | "How do I authenticate?" |

---

## 🔑 Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | [console.anthropic.com](https://console.anthropic.com) |

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "next": "^16.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "unpdf": "latest"
  },
  "devDependencies": {
    "tailwindcss": "^3.0.0",
    "eslint": "latest",
    "eslint-config-next": "latest"
  }
}
```

---

## 🧩 How TF-IDF Retrieval Works

TF-IDF stands for **Term Frequency — Inverse Document Frequency**. It is a classic information retrieval algorithm that scores how relevant a chunk of text is to a search query.

**Term Frequency (TF)**
How often does the query word appear in this chunk?
A chunk that mentions "cybersecurity" 5 times is more relevant to a cybersecurity question than one that mentions it once.

**Inverse Document Frequency (IDF)**
How rare is this word across ALL chunks?
Common words like "the", "is", "a" appear in every chunk — they carry no signal. Rare words like "blockchain" or "RAG" carry strong signal.

**Combined score**
```
score = TF × IDF
```

The top 4 highest-scoring chunks are sent to Claude as context. This means Claude always reads the most relevant parts of your document — not random sections.

---

## 🤝 Related Projects

- **Smart Bookmark Manager** — [github.com/daranikettimuthu20/smart-bookmark-manager](https://github.com/daranikettimuthu20/smart-bookmark-manager) — Local MCP server built with Anthropic MCP SDK, exposing 4 agentic tools to Claude Desktop
- **AI Resume Screener** — [ai-resume-screener-o15z.vercel.app](https://ai-resume-screener-o15z.vercel.app) — ATS scoring, skill-gap detection, and cybersecurity analysis powered by Claude AI

---

## 👩‍💻 About the Author

**Darani Kettimuthu** — AI Engineer and Full Stack Developer based in Apex, NC.

- 🔗 [GitHub](https://github.com/daranikettimuthu20)
- 💼 [LinkedIn](https://linkedin.com/in/daranikettimuthu20)
- 🌐 [Portfolio](https://darani-portfolio.vercel.app)
- 📧 daranikettimuthu20@gmail.com

Open to AI Engineer and Full Stack Developer roles in the USA.
✅ Authorized to work through December 2028 · No sponsorship required.

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

*Built with ❤️ using Claude AI, Next.js, and a custom RAG pipeline — no LangChain, no vector database, just clean JavaScript.*
