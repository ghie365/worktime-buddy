# WorkTime Buddy ⏱️

A dual-job time & income tracker with built-in timezone buddy — built as a Progressive Web App (PWA) for Android.

![Dark Theme](https://img.shields.io/badge/theme-dark-0f0f1a) ![PWA](https://img.shields.io/badge/PWA-installable-7c6cff) ![No Backend](https://img.shields.io/badge/backend-none-00d4aa)

## Features

### 📊 Dashboard
- Live Jakarta ↔ US timezone clocks
- Smart overlap status indicator (🟢 Working hours / 🟡 Maybe available / 🔴 Off hours)
- Today's work summary per job
- Monthly earnings preview
- Recent sessions feed

### ⏱️ Timer
- Start/stop/pause timer for each job
- Manual time entry for missed tracking
- Today's session log with delete

### 💰 Earnings
- Monthly breakdown with month navigation
- Sysadmin: fixed IDR monthly salary
- L3 Engineer: USD hourly rate × hours tracked
- Auto USD → IDR conversion with configurable exchange rate
- Full session history per month

### 🌏 Timezone Buddy
- Live clocks: Jakarta (WIB) + New York (ET), Chicago (CT), Denver (MT), Los Angeles (PT)
- 24-hour working hours overlap visualizer
- Meeting time planner with availability status
- Configurable primary US timezone for dashboard

## Tech Stack

- **Vanilla HTML/CSS/JS** — zero dependencies, instant load
- **PWA** — installable on Android, works offline
- **LocalStorage** — all data stays on your device, no server needed
- **Dark theme** — easy on the eyes

## Getting Started

```bash
# Clone the repo
git clone https://github.com/ghie365/worktime-buddy.git
cd worktime-buddy

# Serve locally (Python)
python -m http.server 8765

# Or use any static file server
npx serve .
```

Then open http://localhost:8765 in your browser.

## Install on Android

1. Open the app URL in **Chrome** on your Android phone
2. Tap **⋮ menu** → **"Add to Home Screen"**
3. Done! It appears as a native app icon

## Configuration

Go to the **Earnings** tab → **Job Settings**:

| Setting | Description | Example |
|---|---|---|
| Sysadmin Monthly Salary | Your fixed monthly salary in IDR | `15000000` |
| L3 Engineer Hourly Rate | Your hourly rate in USD | `45` |
| USD → IDR Exchange Rate | Current exchange rate | `15800` |

## Deploy

This is a static site — deploy anywhere:

- **GitHub Pages**: Settings → Pages → Deploy from branch `main`
- **Netlify**: Drag & drop the folder
- **Cloudflare Pages**: Connect the repo

## License

MIT
