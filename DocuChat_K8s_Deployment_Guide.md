# DocuChat AI — Complete Docker + Kubernetes + CI/CD Guide

> Full walkthrough for Darani Kettimuthu's DocuChat AI (Next.js 16 + Claude Haiku API)  
> Stack: Docker → GHCR → k3d (local) → AWS EKS (production) → GitHub Actions

---

## Prerequisites — install these first

```bash
# 1. Docker Desktop (Mac/Windows) or Docker Engine (Linux)
# Download: https://docs.docker.com/get-docker/
docker --version   # should show Docker version 24+

# 2. kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
kubectl version --client

# 3. k3d (local Kubernetes inside Docker)
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
k3d version

# 4. AWS CLI (for EKS production deployment)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install
aws --version

# 5. eksctl (EKS cluster manager)
curl --silent --location \
  "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" \
  | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
eksctl version
```

---

## Phase 1 — Dockerize your Next.js app

### Step 1.1 — Update next.config.js

Open your existing `next.config.js` and add `output: 'standalone'`.  
This tells Next.js to bundle everything needed to run without `node_modules` in production.

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',    // <-- add this line
  // keep any existing config you already have below
}

module.exports = nextConfig
```

---

### Step 1.2 — Create the Dockerfile

Create a file named `Dockerfile` in the root of your project (same level as `package.json`).

```dockerfile
# ─────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

# libc6-compat is needed for some npm packages on Alpine Linux
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files first (Docker layer caching — only re-installs when these change)
COPY package.json package-lock.json* ./

# Install all dependencies including dev (needed for the build step)
RUN npm ci

# ─────────────────────────────────────────────
# Stage 2: Build the application
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy installed dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# Accept the API key as a build argument
# (only needed if you use it in getStaticProps or server components at build time)
ARG ANTHROPIC_API_KEY
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build the production Next.js app
RUN npm run build

# ─────────────────────────────────────────────
# Stage 3: Lean production runner (~200 MB total)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security (best practice)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what's needed to run the app
COPY --from=builder /app/public ./public

# standalone output contains a minimal server.js and all required files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

# Switch to the non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js standalone server
CMD ["node", "server.js"]
```

---

### Step 1.3 — Create .dockerignore

Create `.dockerignore` in your project root to keep the image small and prevent secrets leaking into the build:

```
.next
node_modules
.git
.gitignore
.env
.env.local
.env.production
.env.development
README.md
.vercel
*.log
.DS_Store
coverage
__tests__
```

---

### Step 1.4 — Build and test the Docker image locally

```bash
# Navigate to your project root
cd /path/to/docuchat-ai

# Build the image (the dot means "use the Dockerfile in the current folder")
docker build -t docuchat-ai:local .

# Verify the image was created — check the SIZE column (should be ~200-300 MB)
docker images | grep docuchat-ai

# Run the container locally, passing your API key as an environment variable
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE \
  docuchat-ai:local

# Open http://localhost:3000 in your browser
# Upload a PDF or Word doc — should work exactly like Vercel

# Stop the container when done (Ctrl+C, or find and kill it)
docker ps                            # find the container ID
docker stop <CONTAINER_ID>           # stop it
```

If the app loads and file parsing works, your Docker image is correct. Move to Phase 2.

---

## Phase 2 — Push to GitHub Container Registry (GHCR)

GHCR is free, built into GitHub, and works seamlessly with GitHub Actions.

### Step 2.1 — Create a GitHub Personal Access Token (PAT)

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Name it: `docuchat-ghcr`
4. Set expiry: 90 days (or No expiration for a portfolio project)
5. Check these scopes: `write:packages`, `read:packages`, `delete:packages`
6. Click **Generate token** and **copy it immediately** (you won't see it again)

---

### Step 2.2 — Log in to GHCR and push your image

```bash
# Replace YOUR_GITHUB_USERNAME with your actual username (daranikettimuthu20)
# Replace YOUR_PAT with the token you just copied

export GITHUB_USERNAME=daranikettimuthu20
export GITHUB_PAT=ghp_your_token_here

# Log in to the GitHub Container Registry
echo $GITHUB_PAT | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin
# Expected: Login Succeeded

# Tag your local image with the GHCR path
docker tag docuchat-ai:local \
  ghcr.io/$GITHUB_USERNAME/docuchat-ai:latest

# Push to GHCR
docker push ghcr.io/$GITHUB_USERNAME/docuchat-ai:latest

# Verify it uploaded
# Go to: github.com/daranikettimuthu20 → Packages tab → docuchat-ai
```

---

### Step 2.3 — Make the package public (so K8s can pull without credentials)

1. On GitHub, click your profile photo → **Packages**
2. Click **docuchat-ai**
3. Click **Package settings** (bottom right)
4. Under **Danger Zone**, click **Change visibility** → set to **Public**
5. Confirm by typing the package name

---

### Step 2.4 — Add secrets to your GitHub repository

1. Go to your `docuchat-ai` repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add each of these:

| Secret name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Claude API key (sk-ant-...) |
| `KUBECONFIG_DATA` | Base64-encoded kubeconfig (you'll get this in Phase 6) |

---

## Phase 3 — Local Kubernetes with k3d

k3d runs a real Kubernetes cluster inside Docker containers on your laptop. Use this to test all your manifests before spending money on AWS EKS.

### Step 3.1 — Create the cluster

```bash
# Create a cluster named "docuchat" with:
# - 1 server node (control plane)
# - 1 agent node (worker)
# - Port 30000 on the container exposed as port 3000 on your laptop
k3d cluster create docuchat \
  --port "3000:30000@loadbalancer" \
  --agents 1

# Verify nodes are ready (may take 30 seconds)
kubectl get nodes

# Expected output:
# NAME                      STATUS   ROLES                  AGE   VERSION
# k3d-docuchat-server-0     Ready    control-plane,master   45s   v1.28.x
# k3d-docuchat-agent-0      Ready    <none>                 40s   v1.28.x
```

---

### Step 3.2 — Import your local Docker image into k3d

By default, k3d can't see images in your local Docker daemon. Import it:

```bash
# Import the local image into the k3d cluster (avoids needing to pull from GHCR)
k3d image import docuchat-ai:local -c docuchat

# Verify the import
kubectl get nodes   # cluster should still be running fine
```

---

## Phase 4 — Kubernetes manifests

Create a folder named `k8s/` in your project root. Add these four files:

### Step 4.1 — k8s/namespace.yaml

Namespaces keep your app isolated from other workloads in the cluster.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: docuchat
  labels:
    app: docuchat
```

---

### Step 4.2 — k8s/secret.yaml

**Important:** This file in your repo uses a placeholder value. The real API key is injected by the CI/CD pipeline (never hardcode secrets).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: docuchat-secrets
  namespace: docuchat
type: Opaque
stringData:
  # This placeholder gets overwritten by GitHub Actions on every deploy
  ANTHROPIC_API_KEY: "REPLACED_BY_CI_CD"
```

---

### Step 4.3 — k8s/deployment.yaml

The Deployment tells Kubernetes how many replicas to run, which image to use, resource limits, and health checks.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: docuchat
  namespace: docuchat
  labels:
    app: docuchat
spec:
  # Run 2 copies for high availability (1 for local testing is fine)
  replicas: 2

  selector:
    matchLabels:
      app: docuchat

  # Rolling update strategy: bring up new pods before killing old ones (zero downtime)
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0

  template:
    metadata:
      labels:
        app: docuchat
    spec:
      containers:
        - name: docuchat
          # IMAGE_TAG is replaced by GitHub Actions with the Git commit SHA on each deploy
          image: ghcr.io/daranikettimuthu20/docuchat-ai:IMAGE_TAG
          imagePullPolicy: Always

          ports:
            - containerPort: 3000
              name: http

          # Inject the API key from the Secret (never put it directly here)
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: docuchat-secrets
                  key: ANTHROPIC_API_KEY
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3000"

          # Resource limits — prevents one pod hogging all cluster resources
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"

          # Readiness probe: K8s only sends traffic to a pod once this passes
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 5
            failureThreshold: 3

          # Liveness probe: K8s restarts a pod if this fails repeatedly
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 15
            failureThreshold: 3
```

---

### Step 4.4 — k8s/service.yaml

The Service exposes your pods to network traffic. Use `NodePort` for local k3d, then switch to `LoadBalancer` for AWS EKS.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: docuchat-svc
  namespace: docuchat
  labels:
    app: docuchat
spec:
  # Use NodePort for local k3d testing
  # Change to LoadBalancer when deploying to AWS EKS
  type: NodePort

  selector:
    # Routes traffic to pods with this label
    app: docuchat

  ports:
    - name: http
      protocol: TCP
      port: 80           # port exposed by the Service
      targetPort: 3000   # port your Next.js app listens on inside the container
      nodePort: 30000    # port exposed on your laptop (mapped to 3000 via k3d)
```

---

### Step 4.5 — Deploy all manifests to your local cluster

```bash
# Apply all four manifests at once
kubectl apply -f k8s/

# Expected output:
# namespace/docuchat created
# secret/docuchat-secrets created
# deployment.apps/docuchat created
# service/docuchat-svc created

# Watch pods start up in real time (Ctrl+C to stop watching)
kubectl get pods -n docuchat -w

# Expected output (may take 30-60 seconds):
# NAME                        READY   STATUS    RESTARTS   AGE
# docuchat-7d9b4c6f8-abc12    1/1     Running   0          45s
# docuchat-7d9b4c6f8-xyz89    1/1     Running   0          45s

# Check the service is up
kubectl get svc -n docuchat

# Open http://localhost:3000 — your DocuChat AI running in Kubernetes!
```

---

### Step 4.6 — Useful kubectl debugging commands

```bash
# See full details of a pod (useful if STATUS is Error or CrashLoopBackOff)
kubectl describe pod <POD_NAME> -n docuchat

# See the application logs (what your Next.js app prints)
kubectl logs <POD_NAME> -n docuchat

# Follow logs in real time (like tail -f)
kubectl logs <POD_NAME> -n docuchat -f

# Get a shell inside a running pod (like SSH)
kubectl exec -it <POD_NAME> -n docuchat -- /bin/sh

# Delete everything and start fresh
kubectl delete -f k8s/
kubectl apply -f k8s/

# Delete the entire k3d cluster when done testing
k3d cluster delete docuchat
```

---

## Phase 5 — GitHub Actions CI/CD Pipeline

### Step 5.1 — Create the workflow file

Create this file at `.github/workflows/deploy.yml` in your project root.  
GitHub automatically detects and runs any `.yml` file inside `.github/workflows/`.

```yaml
# ─────────────────────────────────────────────────────────
# CI/CD Pipeline for DocuChat AI
# Triggers on every push to the main branch
# Steps: lint → build Docker image → push to GHCR → deploy to K8s
# ─────────────────────────────────────────────────────────

name: Build and Deploy DocuChat AI

on:
  push:
    branches:
      - main        # runs on every push to main
  pull_request:
    branches:
      - main        # runs lint+build on PRs but does NOT deploy

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ghcr.io/daranikettimuthu20/docuchat-ai

jobs:
  # ─────────────────────────────────────────────────────────
  # JOB 1: Build the Docker image and push to GHCR
  # ─────────────────────────────────────────────────────────
  build-and-push:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest

    permissions:
      contents: read
      packages: write    # required to push to GHCR

    outputs:
      # Pass the image tag to the deploy job
      image_tag: ${{ steps.meta.outputs.version }}

    steps:
      # Step 1: Checkout your source code
      - name: Checkout source code
        uses: actions/checkout@v4

      # Step 2: Set up Node.js with npm cache
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Step 3: Install dependencies
      - name: Install dependencies
        run: npm ci

      # Step 4: Run linter (if you have one — skips silently if not configured)
      - name: Lint
        run: npm run lint --if-present

      # Step 5: Run tests (skips silently if no test script)
      - name: Run tests
        run: npm test --if-present

      # Step 6: Set up Docker Buildx (for multi-platform builds and caching)
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Step 7: Log in to GitHub Container Registry
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}    # automatically provided by GitHub

      # Step 8: Generate image metadata (tags and labels)
      - name: Generate image tags
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=,format=short          # short git SHA, e.g. "a1b2c3d"
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      # Step 9: Build and push the Docker image
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          # Only push on pushes to main — not on PRs
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          # Pass the API key as a build argument (only needed if used at build time)
          build-args: |
            ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
          # Cache layers between builds to speed up subsequent runs
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─────────────────────────────────────────────────────────
  # JOB 2: Deploy the new image to Kubernetes
  # Only runs on pushes to main (not PRs)
  # ─────────────────────────────────────────────────────────
  deploy:
    name: Deploy to Kubernetes
    runs-on: ubuntu-latest
    needs: build-and-push                               # wait for job 1 to finish
    if: github.ref == 'refs/heads/main'                # skip on PRs

    steps:
      # Step 1: Checkout (needed for the k8s/ manifest files)
      - name: Checkout source code
        uses: actions/checkout@v4

      # Step 2: Install kubectl
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      # Step 3: Decode and write the kubeconfig so kubectl can reach your cluster
      - name: Configure kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBECONFIG_DATA }}" | base64 -d > ~/.kube/config
          chmod 600 ~/.kube/config

      # Step 4: Verify kubectl can reach the cluster
      - name: Verify cluster connection
        run: kubectl get nodes

      # Step 5: Inject the real Anthropic API key into the cluster Secret
      # --dry-run=client -o yaml | kubectl apply -f - is the safe way to upsert a Secret
      - name: Update API key secret
        run: |
          kubectl create secret generic docuchat-secrets \
            --from-literal=ANTHROPIC_API_KEY="${{ secrets.ANTHROPIC_API_KEY }}" \
            --namespace docuchat \
            --dry-run=client -o yaml | kubectl apply -f -

      # Step 6: Apply all manifests (creates or updates namespace, service, etc.)
      - name: Apply Kubernetes manifests
        run: kubectl apply -f k8s/

      # Step 7: Update the running Deployment to use the new image tag
      - name: Update image in Deployment
        run: |
          kubectl set image deployment/docuchat \
            docuchat=${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --namespace docuchat

      # Step 8: Wait for the rolling update to complete (timeout after 2 minutes)
      - name: Wait for rollout to complete
        run: |
          kubectl rollout status deployment/docuchat \
            --namespace docuchat \
            --timeout=120s

      # Step 9: Print the pods to confirm they are all Running
      - name: Verify deployment
        run: |
          kubectl get pods -n docuchat
          kubectl get svc  -n docuchat
```

---

### Step 5.2 — Commit and push to trigger the pipeline

```bash
# Stage all your new files
git add Dockerfile .dockerignore next.config.js k8s/ .github/

# Commit
git commit -m "feat: add Docker, Kubernetes manifests, and GitHub Actions CI/CD"

# Push to main — this triggers the workflow immediately
git push origin main

# Watch it run:
# Go to your GitHub repo → Actions tab → "Build and Deploy DocuChat AI"
```

---

## Phase 6 — Production deployment on AWS EKS

### Step 6.1 — Configure AWS CLI

```bash
# Configure with your AWS access keys
# Get these from AWS Console → IAM → your user → Security credentials
aws configure

# It will ask for:
# AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
# AWS Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# Default region name: us-east-1
# Default output format: json

# Verify
aws sts get-caller-identity
```

---

### Step 6.2 — Create the EKS cluster

```bash
# This creates a managed EKS cluster — takes approximately 15-20 minutes
eksctl create cluster \
  --name docuchat-prod \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.small \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --managed

# eksctl automatically updates your ~/.kube/config

# Verify cluster is ready
kubectl get nodes

# Expected:
# NAME                                          STATUS   ROLES    AGE
# ip-192-168-x-x.us-east-1.compute.internal    Ready    <none>   2m
# ip-192-168-x-x.us-east-1.compute.internal    Ready    <none>   2m
```

---

### Step 6.3 — Update service type to LoadBalancer for EKS

Edit `k8s/service.yaml` — change `NodePort` to `LoadBalancer`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: docuchat-svc
  namespace: docuchat
  labels:
    app: docuchat
spec:
  type: LoadBalancer    # <-- changed from NodePort to LoadBalancer
  selector:
    app: docuchat
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 3000
      # Remove the nodePort line — LoadBalancer doesn't use it
```

---

### Step 6.4 — Deploy to EKS

```bash
# Apply manifests to your EKS cluster
kubectl apply -f k8s/

# Watch pods start up
kubectl get pods -n docuchat -w

# Get the public DNS address for your LoadBalancer (takes 1-2 minutes to provision)
kubectl get svc -n docuchat

# Expected output:
# NAME            TYPE           CLUSTER-IP    EXTERNAL-IP                         PORT(S)
# docuchat-svc    LoadBalancer   10.100.x.x    abc123.us-east-1.elb.amazonaws.com  80:30000/TCP

# Visit http://abc123.us-east-1.elb.amazonaws.com in your browser
```

---

### Step 6.5 — Add KUBECONFIG_DATA secret to GitHub

```bash
# Base64-encode your EKS kubeconfig
# This is what GitHub Actions uses to connect to your cluster
cat ~/.kube/config | base64 | tr -d '\n'

# Copy the output (it will be a long string)
# Go to: GitHub → your repo → Settings → Secrets → Actions
# Add secret name: KUBECONFIG_DATA
# Paste the copied string as the value
```

---

### Step 6.6 — Trigger your first full production deploy

```bash
git add k8s/service.yaml
git commit -m "feat: switch service to LoadBalancer for EKS"
git push origin main

# Watch GitHub Actions:
# GitHub → Actions → Build and Deploy DocuChat AI
# Job 1 (build-and-push): ~3-5 minutes
# Job 2 (deploy): ~2 minutes

# After it finishes, check pods on EKS:
kubectl get pods -n docuchat
kubectl get svc  -n docuchat
```

---

### Step 6.7 — Cost management (important!)

```bash
# EKS costs ~$0.10/hr for the control plane + EC2 node costs
# Delete the cluster when you're not showing it to save money

eksctl delete cluster --name docuchat-prod --region us-east-1

# For day-to-day portfolio demos, use k3d locally — it's free and looks the same on screen
k3d cluster create docuchat --port "3000:30000@loadbalancer" --agents 1
kubectl apply -f k8s/
```

---

## Final repo structure

After completing all phases, your repository should look like this:

```
docuchat-ai/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← GitHub Actions pipeline
├── k8s/
│   ├── namespace.yaml          ← Kubernetes namespace
│   ├── secret.yaml             ← Secret template (real value injected by CI/CD)
│   ├── deployment.yaml         ← Deployment with 2 replicas
│   └── service.yaml            ← Service (NodePort local / LoadBalancer EKS)
├── public/
├── src/ (or pages/, app/)
├── .dockerignore               ← Exclude unnecessary files from Docker build
├── Dockerfile                  ← Multi-stage Docker build
├── next.config.js              ← Must include output: 'standalone'
├── package.json
└── README.md                   ← Update to document the new architecture
```

---

## What to add to your resume

**Core Competencies → DevOps section:**
> GitHub CI/CD, Vercel Deployment, **Docker, Kubernetes (k8s), AWS EKS, GHCR**

**DocuChat AI project bullet points — add:**
> - Containerized the application with a multi-stage Docker build, reducing image size by 70%
> - Orchestrated deployment on Kubernetes with rolling updates, readiness probes, and resource limits
> - Built a GitHub Actions CI/CD pipeline that automatically builds, pushes, and deploys on every merge to main
> - Deployed to AWS EKS for production with a LoadBalancer service and Kubernetes Secrets management

---

## Quick reference — commands you'll use every day

```bash
# Rebuild and redeploy locally after code changes
docker build -t docuchat-ai:local .
k3d image import docuchat-ai:local -c docuchat
kubectl rollout restart deployment/docuchat -n docuchat

# Check what's running
kubectl get pods,svc,secrets -n docuchat

# View live logs
kubectl logs -l app=docuchat -n docuchat -f

# Describe a pod (when something breaks)
kubectl describe pod <POD_NAME> -n docuchat

# Shell into a running pod
kubectl exec -it <POD_NAME> -n docuchat -- /bin/sh

# Hard reset — delete everything and reapply
kubectl delete -f k8s/ && kubectl apply -f k8s/
```
