# 🛡️ AURA SENTINEL

> **Multi-Market Macro & Event-Driven Equity Intelligence Terminal**  
> *Tactile Skeuomorphic Terminal powered by Loughran-McDonald NLP, Google Gemini AI & MongoDB Atlas*

---

## 🌐 Overview

**AURA SENTINEL** is an institutional-grade macroeconomic and equity intelligence platform that synthesizes real-time global news, central bank monetary policies, government capex outlays, and geopolitical developments into actionable market pulse indicators and equity opportunities across two primary operating theaters:

- 🇮🇳 **India Theater (NSE / BSE)** — MoD defense indigenization outlays, RBI rate decisions, PLI manufacturing schemes, power grid capex, and PSU order books.
- 🌐 **Global Theater (US / World)** — Geopolitical defense supply chains, semiconductor foundry sovereignty, nuclear base-load energy, and sovereign debt markets.

---

## 💻 Tech Stack Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AURA SENTINEL ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND (Client)                                                              │
│  ├── Vanilla JavaScript (ES6+) · HTML5 Semantic Markup                          │
│  ├── Custom Skeuomorphic CSS Engine (Dual Theme: Titanium Dark & Platinum Bright)│
│  ├── HTML5 Canvas Vector Oscilloscope (2x DPR Retina Scaling & Bezier Curves)  │
│  └── Web Audio API (Synthetic Mechanical Haptics & Relay Snaps)                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  BACKEND (Server)                                                               │
│  ├── Node.js (v18+) Runtime Engine                                              │
│  ├── Zero-Dependency Native HTTP / REST API Routing                             │
│  └── Role-Based Access Control (RBAC) & Governance Security Gateway             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  AI & FINANCIAL NLP                                                             │
│  ├── Google Gemini AI (Gemini 2.5 Flash / 1.5 Flash) Synthesis                  │
│  └── Loughran-McDonald Financial Lexicon & Sentiment Scoring Engine             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  DATABASE & STORAGE                                                             │
│  ├── MongoDB Atlas (AWS Mumbai ap-south-1 · Cloud User Registry & Watchlists)   │
│  └── Browser LocalStorage Sandbox (Zero-Latency Fallback Cache)                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  DATA FEEDS & CLOUD DEVOPS                                                      │
│  ├── Multi-Region Financial RSS Feeds (PIB, Yahoo Finance, Business Standard)   │
│  └── Render.com Cloud Platform (Automated Continuous GitHub CI/CD)              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Frontend Tier
* **Core**: Pure **HTML5** & **Vanilla JavaScript (ES6+)** — zero heavy single-page application framework overhead for instantaneous load times and 60fps rendering.
* **Styling**: Handcrafted **Skeuomorphic CSS3 Engine** utilizing CSS custom properties, inset bevel shadows, brushed metal gradients, CRT phosphor glow effects, and responsive mobile flex/grid layouts.
* **Dual Theme Engine**: Instant toggling between **Titanium Obsidian (Dark Mode)** and **Brushed Platinum (Bright Mode)**.
* **Vector Charting Engine**: High-DPI Retina **HTML5 Canvas** rendering smooth cubic/quadratic Bezier trajectory curves and dynamic grid lines.
* **Tactile Audio Feedback**: **Web Audio API** oscillator synthesizing real-time mechanical switch clicks and relay snaps without external audio files.

### 2. Backend & Server Tier
* **Runtime**: **Node.js (v18+)** asynchronous event-driven architecture.
* **API Architecture**: Clean RESTful endpoints for macro synthesis, stock deep-dives, search autocomplete, authentication, and admin governance.
* **Authentication & RBAC**: Role-Based Access Control enforcing distinct security clearances for `ADMIN` (Root Governance) and `ANALYST` (Standard Intelligence).

### 3. Database & Persistence
* **Cloud Database**: **MongoDB Atlas (M0 Free Forever Cluster on AWS Mumbai `ap-south-1`)** providing permanent cross-device account syncing between PC, iPhone, and Android.
* **Local Offline Fallback**: Browser **`localStorage`** sandbox for instant offline caching and session persistence.

### 4. AI & Financial NLP
* **Google Gemini AI (`gemini-2.5-flash` / `gemini-1.5-flash`)**: Autonomous macroeconomic synthesis, executive market summaries, and multi-sector catalyst evaluations.
* **Loughran-McDonald Sentiment Lexicon**: Wall Street-standard financial dictionary for categorizing geopolitical risk, monetary stance, and corporate earnings catalysts.

### 5. Market Data & News Ingestion
* **Live RSS News Ingestion**: Aggregates verified feeds from Government Press Information Bureau (PIB India), Google Finance, Business Standard, Reuters, and Yahoo Finance RSS.
* **Equity Market Quotes**: Real-time price tracking, intraday sparklines, market caps, and volume metrics for NSE/BSE and US/Global exchanges.

### 6. Cloud Deployment & CI/CD
* **Hosting**: **Render.com Cloud Web Service** with automated GitHub continuous integration.
* **Version Control**: Git & GitHub repository management.

---

## ⚡ Key Features

- **Analog Skeuomorphic UI**: Machined titanium chassis, tactile rocker switches, analog needle meters, CRT oscilloscope chart, and flip-clock countdown.
- **Dual Operating Theaters**: Seamlessly toggle between India (`NSE`/`BSE`) and Global (`US`/`World`) market radars.
- **👑 Master Admin Governance Console**: Dedicated root management deck to provision new analysts, promote/demote roles, and revoke MongoDB cloud access.
- **Hourly Auto-Sync & Manual Push**: Automatic hourly news ingestion with on-demand hardware-style push refresh.
- **Stock Deep Dive & Oscilloscope**: Dynamic timeframe selector (`1D`, `1W`, `1M`, `6M`, `1Y`, `3Y`) with technical price trajectory and sentiment correlation.
- **Cross-Device Watchlist**: Pin favored stocks across devices with persistent cloud vault sync.

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- Free MongoDB Atlas URI (optional, automatic memory fallback if not provided)
- Google Gemini API Key (optional, from [Google AI Studio](https://aistudio.google.com))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sverma9312/aura-sentinel.git
   cd aura-sentinel
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment (`.env`):**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   MONGODB_URI=your_mongodb_connection_string_here
   ADMIN_EMAIL=admin@aura.capital
   ADMIN_PASSWORD=admin2026
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open Terminal:**
   Navigate to `http://localhost:3000` in your web browser.

---

## 🔒 Default Security Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Master Admin** | `admin@aura.capital` | `admin2026` | 👑 Full Root Governance & User Management |
| **Demo Analyst** | `analyst@aura.capital` | `sentinel2026` | ⚡ Tier-1 Macro & Equity Intelligence |

---

## 📜 License

MIT License © 2026 AURA SENTINEL Financial Architecture Team
