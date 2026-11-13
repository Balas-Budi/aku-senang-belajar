# Aku Senang Belajar

AI learning platform for Indonesian primary school (SD) students + teachers. Teacher uploads book, AI turns it into interactive learning missions with mascot **si Jalak** (Bali starling), teacher verifies each student's understanding per competency.

## Background

### Problem: a correct answer is not understanding

Students hand in correct answer, with or without AI, without understanding concept. Each student needs different help, but teachers lack evidence to see who needs what.

Exploratory survey at **SDN 1 Kaliwungu, Ngunut District** (October 2026, 10 teachers, 13 grade 5–6 students; small sample, early signals only):

- **8 of 10 teachers** see students who answer but cannot explain _why_.
- **9 of 13 students** use AI: 7 to explain material, 2 to get answers.
- **10 of 13 students** say teacher's direct explanation helps most.
- Students most want to learn **through stories** (5 of 13).

|             | Student side                                                   | Teacher side                             |
| ----------- | -------------------------------------------------------------- | ---------------------------------------- |
| **Problem** | Passive, one-size-fits-all learning; general AI gives answers. | Teachers see final scores, not thinking. |
| **Result**  | Students "finish" without understanding.                       | Follow-up stays generic for whole class. |

### Solution: two pillars

#### 1. AI Personalized Learning

**Problem:** passive, uniform material; AI hands out answers.
**Solution:** AI turns teacher's material into interactive mission.

- Continuing story with si Jalak, student as hero.
- Active tasks every few screens: choose, order, match, group.
- Graded hints + retries, never dead end; answers come after learning.
- Transfer challenge in new situation, answered with reason (typed or spoken).
- Story themes + help order adapt per student; **competencies stay same for all**.

#### 2. AI Learning Understanding

**Problem:** teachers cannot see how students think.
**Solution:** each answer becomes **evidence** linked to competency; AI analyses with rubric; **teacher decides**.

- Status per competency (_Not yet observed_, _Developing_, _Visible_, _Needs verification_), not one score.
- Each conclusion cites evidence, says when evidence not enough.
- Teacher confirms or changes each status, with suggested verification questions.
- Reports, follow-up plans, class challenges; each mission shapes next.

## How it works

1. Teacher uploads PDF book; AI splits into chapters + competencies.
2. AI drafts mission for chapter; teacher reviews + approves in studio.
3. Teacher opens chapter for class; students take mission.
4. AI analyses evidence; teacher verifies + plans follow-up.

Teacher's material = source of truth: AI drafts only inside chosen chapter + competencies; nothing reaches students without teacher approval.

## Architecture

```
Frontend (React 19, React Router 8 SSR, TanStack Query, Tailwind 4)
   │  /api
Backend (Fastify 5, Zod, Drizzle ORM, background AI workers)
   ├── PostgreSQL + pgvector
   └── AI provider (OpenAI-compatible chat + embeddings)
```

Nx monorepo: `packages/frontend` and `packages/backend`. Every AI prompt versioned; every AI reply validated + repaired before use. Roles: admin, teacher, student.

## Running locally

Requirements: Node.js 26, PostgreSQL with pgvector, OpenAI-compatible AI API key.

```bash
nvm use && npm install
cp .env.example .env          # set DATABASE_URL, AI_* values
createdb aku_senang_belajar
npm run db:migrate
npm exec nx run backend:create-admin -- admin "School Admin"
npm run dev                   # backend :3000, frontend :4200
```

`npm run check` runs format check, typecheck, tests, build.

## Usage

- **Admin**: create teacher + student accounts (or import from Excel), manage subjects, place students in classes.
- **Teacher**: create class + share invite code, upload book, draft + approve missions, open chapters, verify evidence.
- **Student**: join with invite code, pick subject, follow mission trail with si Jalak.

## License

[MIT](LICENSE)
