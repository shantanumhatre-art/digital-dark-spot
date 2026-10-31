# DIGITAL DARK SPOT
AI-assisted information gap detection platform.

## Requirements
- Node.js 20 or newer
- npm
- VS Code

## Run locally
1. Open this folder in VS Code.
2. Open Terminal > New Terminal.
3. Run `npm install`
4. Run `npm --prefix client install`
5. Run `npm --prefix server install`
6. Optional: copy `server/.env.example` to `server/.env` and add a Gemini API key.
7. Run `npm run dev`
8. Open the frontend at http://localhost:5175

The backend runs at http://localhost:5000.

## How to use
- Enter a research question.
- Add a source by URL, or paste source text.
- Add at least two sources for a useful comparison.
- Click Analyse sources.
- Review the summary, potential gaps, possible conflicts, date warnings, and verification checklist.
- Open source links to inspect original material.

## AI mode
Without a Gemini key, the app uses a transparent rule-based prototype analyzer. To enable Gemini:
- Copy `server/.env.example` to `server/.env`
- Set `GEMINI_API_KEY=your_key_here`
- Restart the server.

Do not commit `.env` or share your API key. AI findings are suggestions and must be verified against original sources.

## GitHub
Create a public repository and push this folder. Do not upload `.env`, `node_modules`, or private keys.
