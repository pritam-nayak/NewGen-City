# NextGen City — Integrated Command and Control Centre (ICCC)

NextGen City is a production-ready, multi-role Smart City Integrated Command and Control Centre (ICCC) web application designed for Indian urban standards (MoHUA, NUDM, and Digital India compliant). It features a 3-tier architecture combining a responsive frontend (`src/App.tsx`), a local storage backend state manager, and an autonomous 5-Agent AI decision engine (`src/engine.ts`).

---

## 🏛️ Project Architecture & File Structure

Based on your project workspace, here is how the architecture is organized:

* **`src/App.tsx`** — **Frontend UI Layer**: Manages the multi-role layout, MoHUA header, live status bars, and role switcher dashboards (Citizen, Field Engineer, Ward Officer, MLA Command).
* **`src/engine.ts`** — **Autonomous AI Agents Layer**: Houses the core 5-Agent logic engine (Intake/Deduplication, Municipal Routing, Telemetry Correlation, Public Health Surveillance, and SLA Guardian) along with fallback deterministic rules and Gemini API handlers.
* **`src/engine.test.ts`** — **Testing Suite**: Contains unit tests verifying the accuracy and sequential logic of the 5 AI agents.
* **`src/main.tsx` & `src/index.css**` — **React Entry & Styling**: Configures the root render lifecycle and Tailwind CSS styling.
* **`server.ts`** — **Backend Server Layer**: Lightweight Node/Express backend infrastructure script to assist with server-side communication channels.
* **`package.json` & `vite.config.ts**` — **Configuration**: Dependency manifests and Vite build settings.

---

## 🤖 The 5-Synchronized Autonomous Agents

1. **Intake & Deduplication Agent**: Ingests reports, scans a 300-meter geographic radius, and checks semantic similarity (>75%). Blocks duplicate spam, groups reports, and increments citizen upvotes.
2. **Municipal Routing & SLA Agent**: Maps incoming issues strictly to Indian ULB departments (Jal Board, DISCOM, PWD, SWM, SPCB, CMO/108 Health) with strict SLA deadlines (2h to 48h).
3. **Telemetry & Multi-Domain Correlation Agent**: Cross-evaluates reports with IoT sensor data (IMD rain radar, CPCB AQI, DISCOM grid loads) to catch cascading hazards (e.g., Heavy Rain + Burst Sewage Pipeline).
4. **Public Health & Epidemic Surveillance Agent**: Cross-correlates water contamination sensor alerts with localized medical admissions to flag outbreak clusters and dispatch mobile medical units.
5. **SLA Guardian & Escalation Agent**: Audits ticket resolution countdowns. If an SLA breaches (0h remaining), it autonomously reassigns the ticket to the *Ward Assistant Commissioner / Executive Engineer*.

---

## 🔐 Multi-Role Access Control

The application implements role-based dashboards across four key profiles:

* **Citizen Portal**: Illiterate-accessible intake with picture category buttons, Hindi voice microphone (`webkitSpeechRecognition`), auto-GPS ward detection, and Hindi text-to-speech audio receipts (`speechSynthesis`).
* **Field Engineer Desk**: Displays assigned ward work orders and simulates photo proof resolution uploads.
* **Ward Municipal Officer**: Tracks real-time SLA countdown timers, breach counts, and agent audit logs.
* **MLA / Minister Command View**: Provides high-level analytics, city-wide ward grievance heatmaps, public health epidemic surveillance metrics, and citizen upvote tracking.

---

## NewGen City citizen portal

This deployment branch also contains the separate NewGen City citizen portal:
`frontend/` is its React/Vite website, `backend/` is its Express API, and
`database/schema.sql` initializes its PostgreSQL database. To deploy this
portal from this branch, set the Vercel project root to `frontend/`. Create the
API service from the root `render.yaml` Blueprint and configure
`DATABASE_URL`, `FRONTEND_ORIGIN`, and `OPS_API_TOKEN` in Render; then set
`VITE_API_URL` in the Vercel project to the Render API URL. Never commit
deployment secrets. The existing NextGen City app at the repository root is
kept unchanged.

---

## 🚀 Getting Started & Local Development

### 1. Install Dependencies

Make sure you have Node.js installed, then run:

```bash
npm install

```

### 2. Run the Development Server

```bash
npm run dev

```

Open the local development URL provided by Vite (usually `http://localhost:5173`) in your browser.

### 3. Running Tests

To verify the agent logic rules:

```bash
npm test

```

---

## 📦 Deployment & Publishing

### Deploy via Vercel (Recommended)

1. Push your code to a public GitHub repository.
2. Go to [Vercel](https://vercel.com/), click **Add New Project**, and import your repository.
3. Vercel will automatically configure the build settings (`npm run build`). Click **Deploy** to generate a live public URL.

### Deploy via GitHub Pages

1. Install `gh-pages`:
```bash
npm install gh-pages --save-dev

```


2. Update your `package.json` with your build scripts and homepage URL, then run:
```bash
npm run deploy

```
