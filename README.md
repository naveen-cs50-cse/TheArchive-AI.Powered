# The Archive — AI-Powered Second Brain

A full-stack knowledge vault for saving notes, uploading PDFs, and asking questions over your own content using semantic search and vector embeddings.

live demo link : https://naveen-cs50-cse.github.io/TheArchive-AI.Powered/

The project includes:
- User authentication with signup/login and JWT-protected API routes
- Note capture, PDF ingestion, and document chunk embedding
- Semantic search and retrieval over stored content
- Retrieval-augmented generation (RAG) responses grounded in your archived notes
- Persistent chat memory for context-aware assistant replies

## Tech stack
- Backend: Node.js + Express
- Database: Prisma ORM with SQLite (`backend/prisma/schema.prisma`)
- AI Embeddings: Google Gemini text-embedding-004
- PDF extraction: `unpdf`
- Frontend: static HTML/CSS/JavaScript (`frontend/index.html`, `frontend/app.js`, `frontend/style.css`)

## Project structure
```
backend/
  package.json
  server.js
  db.js
  clean.js
  middleware/
    auth.js            # JWT auth middleware
  routes/
    auth.js            # signup/login routes
    groq_ai.js         # answer generation / AI completion logic
    routes.js          # main notes/query/pdf API routes
  services/
    gemini_ai.js       # Google Gemini embedding provider
  prisma/
    schema.prisma      # data model definitions

frontend/
  index.html           # UI and layout
  app.js               # frontend logic and API calls
  style.css            # styling

README.md
```

## Features
- Register and login with email/password
- Store text notes into a personal archive
- Upload PDF files, extract text, and create searchable chunks
- Search by natural language query using embeddings
- Receive assistant answers grounded in your archive
- Reset the local archive from the frontend

## Database models
The Prisma schema defines:
- `User` — users with name, email, password
- `Note` — raw note and PDF content linked to a user
- `Chunk` — text chunks with serialized vector embeddings
- `Chat` — assistant and user messages for chat history

## Setup
1. Open a terminal in `backend/`.
2. Install packages:
```bash
npm install
```
3. Generate Prisma client:
```bash
npx prisma generate
```
4. Apply Prisma migrations (if available):
```bash
npx prisma migrate deploy
```
5. Create a `.env` file in `backend/`.

### Required environment variables
```env
PORT=4000
JWT_SECRET=your_jwt_secret_here
GEMINI_API_KEY=your_google_gemini_api_key
```

> The current backend is configured to use SQLite via `backend/prisma/schema.prisma`.

## Run the app
From `backend/`:
```bash
npm run dev
```

Then open `frontend/index.html` in a browser, or serve the `frontend/` directory with a simple static server.

## API endpoints
- `POST /auth/signup` — create an account
- `POST /auth/login` — authenticate and receive JWT
- `GET /api/notes` — list current user notes
- `POST /api/write` — save a new text note
- `POST /api/query` — ask a semantic search question
- `POST /api/upload-pdf` — upload and process a PDF
- `GET /api/reset` — clear/reset stored data

## Usage
1. Register or sign in from the frontend.
2. Save notes or upload PDFs.
3. Enter a search query and view the AI-assisted answer.
4. Use the “Consult Full Ledger” button to list saved notes.

## Notes
- The backend stores embeddings as JSON strings in the `Chunk` model.
- The search route uses cosine similarity plus simple keyword boosting to retrieve relevant chunks.
- The assistant answer service combines retrieved context with recent chat history.

## Development tips
- Change the embedding provider in `backend/services/gemini_ai.js` to switch models.
- Customize prompt generation in `backend/routes/groq_ai.js`.
- Inspect the local database with `npx prisma studio` from the `backend/` folder.

## Contact
Built for The Archive project.
