# Standup Tracker Pro

A forensic attendance management system for remote teams. Track daily standups, detect ghost promises, verify excuses, and generate comprehensive audit reports.

## Features

- **Dashboard** — Real-time attendance tracking with morning/evening status for each team member
- **Ghost Detection** — Automatically identifies team members who promised updates but never delivered
- **Excuse Verification** — Built-in workflow to verify "no internet" and other absence claims with evidence collection
- **Trust Scoring** — Algorithmic trust scores (0-100) based on 30-day attendance patterns
- **Attendance Matrix** — Monthly calendar view showing all status codes at a glance
- **Report Export** — PDF, CSV, Confluence, and Ghost Analysis reports
- **Audit Trail** — Complete history of all status changes with timestamps
- **Offline-First** — Works without internet via Service Worker + IndexedDB (Dexie.js)
- **PWA** — Installable as a native app on mobile and desktop

## Tech Stack

- **Frontend**: Vanilla JS, Tailwind CSS (CDN), HTML5 Templates
- **Storage**: IndexedDB via [Dexie.js](https://dexie.org/)
- **PDF**: jsPDF + AutoTable
- **Icons**: Lucide Icons
- **Deployment**: Vercel (static)

## Status Codes

| Code | Meaning |
|------|---------|
| PA | Present Active |
| AA | Present Async |
| AG | Ghost Promise |
| PL | Present Late |
| IV | Informed Valid |
| NI | No Internet |
| NR | No Response |
| FE | Fake Excuse |
| RC | Chat Only |
| AD | Async Deferred |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Deploy — no build step needed (static site)

The included `vercel.json` handles:
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Service Worker caching rules
- SPA routing fallback

### Manual

Serve the files from any static file server. No build step required.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Confirm save |
| `Ctrl+E` | Jump to Reports |
| `Escape` | Close modal |

## Data Management

- **Export**: Settings → Export Full Database (JSON backup)
- **Import**: Settings → Import Database (restore from JSON)
- All data is stored locally in your browser's IndexedDB

## License

MIT
