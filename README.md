# 🛡️ AURA SENTINEL

> **Multi-Market Macro & Event-Driven Equity Intelligence Terminal**  
> *Tactile Skeuomorphic Terminal powered by Loughran-McDonald NLP & Google Gemini AI*

---

## 🌐 Overview

**AURA SENTINEL** is an institutional-grade macroeconomic intelligence platform that synthesizes daily worldwide events, geopolitical developments, central bank monetary policy, and sector capex flows into actionable market radar themes and equity opportunities across:

- 🇮🇳 **India Theater (NSE / BSE)** — MoD defense indigenization outlays, RBI rate decisions, PLI schemes, power grid capex, and PSU order books.
- 🌐 **Global Theater (US / World)** — Geopolitical defense supply chains, AI semiconductor foundry sovereignty, nuclear base-load energy, and monetary policy.

---

## ⚡ Key Features

- **Analog Skeuomorphic UI**: Machined titanium chassis, tactile toggle switches, analog needle meters, CRT oscilloscope chart, flip-clock countdown, and mechanical sound feedback via Web Audio API.
- **Dual Operating Theaters**: Seamlessly toggle between India and Global market radars with localized sector models and stock coverage.
- **Dual-Engine AI Intelligence**:
  - **Loughran-McDonald Financial NLP**: Keyword and catalyst extraction across live RSS news feeds.
  - **Google Gemini AI Synthesis**: Generates narrative market briefings and catalyst summaries on every refresh cycle.
- **Hourly Auto-Sync & Manual Push**: Automatic hourly news ingestion and synthesis with on-demand hardware-style refresh.
- **Stock Deep Dive & Oscilloscope**: Dynamic timeframe selector (`1D`, `1W`, `1M`, `6M`, `1Y`, `3Y`) with technical price trajectory and sentiment correlation.
- **Watchlist & Security Vault**: Localized session management with theme preferences (Dark Titanium / Bright Platinum).

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
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

3. **Configure Environment:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open Terminal:**
   Navigate to `http://localhost:3000` in your web browser.

---

## 🔒 Security & Provenance

- Zero external analytics tracking.
- Client authentication and watchlist stored locally via browser `localStorage`.
- All financial data fetched through public RSS news wire feeds and financial quote endpoints with graceful fallback handling.

---

## 📜 License

MIT License © 2026 AURA SENTINEL Architecture Team
