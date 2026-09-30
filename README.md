# ExpenseTracker

A personal finance tracker built as an installable PWA and Android app. It records income and
expenses, converts every amount into a single reporting currency, charts the results, and exports
them to CSV / Excel / PDF.

The backend is **Supabase** (Postgres + Auth + private Storage) with **Row Level Security** as the
only authorization mechanism. The app is a PWA, so a single codebase serves desktop, mobile web,
and the Capacitor Android build.

---

## Tech stack

| Layer      | Choice                                                             |
| ---------- | ------------------------------------------------------------------ |
| UI         | React 19, TypeScript (strict), Tailwind CSS 4, Lucide icons        |
| Charts     | Recharts + date-fns                                                 |
| Export     | xlsx, jsPDF + jspdf-autotable                                       |
| Backend    | `@supabase/supabase-js` — Postgres, GoTrue auth, private Storage    |
| Mobile     | Capacitor 8 (Android)                                              |
| PWA        | vite-plugin-pwa (service worker, precache, offline shell)          |
| Build      | Vite 8, oxlint, TypeScript project references                      |

---

## 1. Prerequisites

- Node.js 20.19+ (or 22+) and npm
- A free [Supabase](https://supabase.com) project
- Android Studio + Android SDK (only for the Android build)

## 2. Supabase project setup

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql)
   and run it. It is safe to re-run.
   This creates:
   - `public.transactions` with the `updated_at` trigger and two indexes
   - RLS enabled plus the four per-user select/insert/update/delete policies
   - the private `receipts` storage bucket with three per-user storage policies
3. **Authentication → Providers**
   - enable **Email**
   - optionally enable **Google**: add the Google client ID/secret, then set the
     redirect to `https://<project-ref>.supabase.co/auth/v1/callback`
4. **Authentication → URL Configuration**
   - **Site URL**: the origin you will serve the app from, e.g. `http://localhost:5173`
   - **Redirect URLs**: add `http://localhost:5173/**`, your production origin, and
     `https://<project-ref>.supabase.co/auth/v1/callback`
5. **Project Settings → API** — copy the project URL and the `anon` public key.

Only the *anon* key ever goes in the app. It is safe to ship: it can read nothing that RLS does not
already allow, and it cannot bypass the policies above. Never put the `service_role` key in `.env`
or in any `VITE_*` variable — those are bundled into the JavaScript.

## 3. Environment variables

```bash
cp .env.example .env
```

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`.env` is gitignored. Restart the dev server after editing it.

## 4. Install and run

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script          | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `npm run dev`   | Vite dev server with hot reload                                     |
| `npm run build` | Type-checks (`tsc -b`), builds to `dist/`, generates the SW, then `postbuild` copies a built APK into `public/app.apk` if one exists |
| `npm run lint`  | oxlint                                                              |
| `npm run preview` | Serves the production build locally                               |

## 5. Android build

The `android/` platform is intentionally not committed. Create it once:

```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android        # or: cd android && gradlew assembleDebug
```

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- The `postbuild` script copies that file to `public/app.apk`, which is what the **App Download**
  link in Settings serves to phones. If the APK is not built yet the script logs a message and
  exits successfully.
- For a release build, create a signing key
  (`keytool -genkey -v -keystore release.keystore -alias expense -keyalg RSA -keysize 2048 -validity 10000`),
  configure `android/app/build.gradle`, then run `./gradlew assembleRelease` in `android/`.
- Supabase auth on device uses the Google redirect through the in-app browser; keep the
  `androidScheme: "https"` setting and your production Site URL in sync.

## 6. Data, privacy, and security

- Every table and storage object is scoped to `auth.uid()`. The client never filters by user id
  for security purposes — RLS does it.
- `transactionService` accepts a `userId` argument only for call-site compatibility; a mismatch is
  logged and ignored, because the query is still constrained to the signed-in user.
- Receipts are uploaded to the private `receipts` bucket as `<user-id>/<timestamp>_<file-name>`,
  which is the layout the storage policies check. The database stores only that path; signed URLs
  are generated on read, so a leaked row never leaks a working link.
- Deleting a transaction also removes its receipt; replacing a receipt uploads the new file first
  and only then deletes the old one, so a failed write cannot destroy data.
- `auth.users` is referenced by foreign key with `on delete cascade` — deleting an account in
  Supabase removes its transactions.

## 7. Features

- Email/password and Google sign-in, sign-up, sign-out
- Add, edit, and delete income/expense entries with type, category, date, amount, currency,
  description, and an optional receipt photo
- Live totals, income-vs-expense line chart, and per-category donut charts (week / month / all time)
- Multi-currency conversion into a configurable default currency
- Search and filter the transaction list; CSV, Excel, and PDF exports of the filtered set
- Light/dark mode, five accent palettes, offline-capable PWA shell

## 8. Project layout

```
src/
  components/ProtectedRoute.tsx   auth gate for private routes
  context/                        Auth (Supabase), Theme, Settings providers
  lib/supabase.ts                 client, table/column mapping, row → Transaction
  pages/                          Login, Signup, Dashboard, AddData, EditTransaction,
                                  ExpenseList, Analytics, Export, Settings
  services/                       transactionService, currencyService, exportService
  types/expense.ts                Transaction type, categories, currency tables, formatting
supabase/schema.sql               tables, indexes, RLS policies, trigger, storage bucket
scripts/copy-apk.js               postbuild APK copy
```
