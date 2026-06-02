# DocuChat AI — Multi-Format RAG Chatbot

> Chat with any document. Upload a PDF, Word, Excel, PowerPoint, CSV, TXT, or Markdown file and get instant AI-powered answers — powered by Claude Haiku and a custom RAG pipeline built from scratch.

🔗 **Live Demo:** [docuchat-ai-w86t.vercel.app](https://docuchat-ai-w86t.vercel.app)
📦 **GitHub:** [github.com/daranikettimuthu20/docuchat-ai](https://github.com/daranikettimuthu20/docuchat-ai)

---

## What it does

- Upload any of 7 file formats — PDF, Word, Excel, PowerPoint, CSV, TXT, Markdown
- Automatically detects the file format and parses it server-side
- Chunks the content, scores it with custom TF-IDF retrieval, and retrieves the most relevant sections
- Passes retrieved context to Claude Haiku API to generate accurate, grounded answers
- Maintains multi-turn conversation memory across the session

---

## Architecture

```
User uploads file
       ↓
Next.js API Route
       ↓
Format Detection → unpdf / mammoth / xlsx / officeparser
       ↓
Text Chunking (500-word overlap chunks)
       ↓
TF-IDF Relevance Scoring + Top-K Retrieval
       ↓
Claude Haiku API (RAG prompt with retrieved context)
       ↓
Streaming response to user
```

### Why no LangChain or vector database?

The RAG pipeline is built entirely from scratch — no LangChain, no Pinecone, no external vector store. This was a deliberate engineering choice to demonstrate deep understanding of how retrieval-augmented generation actually works under the hood, including chunking strategy, relevance scoring, and hallucination prevention via system prompt engineering.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, Tailwind CSS |
| Backend | Next.js API Routes |
| AI | Claude Haiku API (Anthropic) |
| Retrieval | Custom TF-IDF scoring, Top-K retrieval |
| File parsing | unpdf, mammoth, xlsx, officeparser |
| Containerization | Docker (multi-stage build) |
| Orchestration | Kubernetes (k8s) |
| Cloud | AWS EKS |
| CI/CD | GitHub Actions + GHCR |
| Deployment | Vercel (production), AWS EKS (cloud demo) |

---

## Docker — Containerization

The app uses a **3-stage multi-stage Docker build** to keep the final image lean (~200 MB vs 1+ GB with a naive build):

```
Stage 1: deps     — installs all npm dependencies
Stage 2: builder  — builds the Next.js standalone output
Stage 3: runner   — lean Alpine image with only what's needed to run
```

### Run locally with Docker

```bash
# Build the image
docker build -t docuchat-ai:local .

# Run the container
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your_key_here \
  docuchat-ai:local

# Visit http://localhost:3000
```

---

## Kubernetes — Orchestration

The app is fully orchestrated on Kubernetes with production-grade configuration:

```
k8s/
├── namespace.yaml     — isolated docuchat namespace
├── secret.yaml        — API key injected by CI/CD (never hardcoded)
├── deployment.yaml    — 2-replica deployment with rolling updates
└── service.yaml       — LoadBalancer service (NodePort for local)
```

### Key Kubernetes features used

- **2 replicas** for high availability
- **Rolling update strategy** — zero downtime on deployments (`maxSurge: 1`, `maxUnavailable: 0`)
- **Readiness probe** — traffic only sent to pods that are ready
- **Liveness probe** — unhealthy pods automatically restarted
- **Resource limits** — memory and CPU capped to prevent resource hogging
- **Kubernetes Secrets** — API key injected securely, never stored in code

### Run locally with k3d (free local Kubernetes)

```bash
# Create local cluster
k3d cluster create docuchat --port "3000:30000@loadbalancer" --agents 1

# Import your local Docker image
k3d image import docuchat-ai:local -c docuchat

# Deploy all manifests
kubectl apply -f k8s/

# Watch pods start
kubectl get pods -n docuchat -w

# Visit http://localhost:3000
```

### Deploy to AWS EKS (production)

```bash
# Create EKS cluster
eksctl create cluster \
  --name docuchat-prod \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.small \
  --nodes 2 \
  --managed

# Deploy
kubectl apply -f k8s/

# Inject API key
kubectl create secret generic docuchat-secrets \
  --from-literal=ANTHROPIC_API_KEY="your_key_here" \
  --namespace docuchat \
  --dry-run=client -o yaml | kubectl apply -f -

# Get public URL
kubectl get svc -n docuchat
```

---

## CI/CD — GitHub Actions Pipeline

Every push to `main` automatically:

```
1. Checks out code
2. Installs dependencies and runs lint
3. Builds a Docker image (multi-stage)
4. Pushes to GitHub Container Registry (GHCR) with the Git SHA as the tag
5. Injects the real API key into the Kubernetes Secret
6. Updates the Deployment to use the new image tag
7. Waits for the rolling update to complete
```

```yaml
# Triggered on every push to main
on:
  push:
    branches: [main]
```

No manual deployment steps — `git push` is the entire release process.

### Pipeline diagram

```
git push origin main
        ↓
GitHub Actions triggers
        ↓
┌─────────────────────────┐
│  Job 1: Build & Push    │
│  • npm ci + lint        │
│  • docker build         │
│  • docker push → GHCR  │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  Job 2: Deploy          │
│  • kubectl apply -f k8s/│
│  • kubectl set image    │
│  • rollout status       │
└─────────────────────────┘
```

---

## Project Structure

```
docuchat-ai/
├── .github/
│   └── workflows/
│       └── deploy.yml        — GitHub Actions CI/CD pipeline
├── k8s/
│   ├── namespace.yaml         — Kubernetes namespace
│   ├── secret.yaml            — Secret template (real value injected by CI/CD)
│   ├── deployment.yaml        — Deployment with 2 replicas + probes
│   └── service.yaml           — NodePort (local) / LoadBalancer (EKS)
├── app/
│   ├── api/                   — Next.js API routes (file parsing, chat)
│   ├── page.jsx               — Main chat UI
│   └── layout.js              — App layout
├── components/                — React components
├── lib/                       — TF-IDF retrieval, chunking logic
├── public/                    — Static assets
├── Dockerfile                 — Multi-stage Docker build
├── .dockerignore              — Files excluded from Docker build
├── next.config.mjs            — Next.js config (standalone output)
└── package.json
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Claude API key from console.anthropic.com |

For local development, create a `.env.local` file:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

For Kubernetes, the key is injected via a Kubernetes Secret by the CI/CD pipeline — never stored in code or Docker images.

---

## Local Development (without Docker)

```bash
# Clone the repo
git clone https://github.com/daranikettimuthu20/docuchat-ai.git
cd docuchat-ai

# Install dependencies
npm install

# Create .env.local with your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key" > .env.local

# Start dev server
npm run dev

# Visit http://localhost:3000
```

---

## Author

**Darani Kettimuthu**
- Portfolio: [portfolio-888j.vercel.app](https://portfolio-888j.vercel.app)
- LinkedIn: [linkedin.com/in/daranikettimuthu](https://www.linkedin.com/in/daranikettimuthu)
- GitHub: [github.com/daranikettimuthu20](https://github.com/daranikettimuthu20)