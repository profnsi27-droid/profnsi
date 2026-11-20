# PROFNSI — Plateforme personnelle d'évaluation NSI

Plateforme web destinée à un **professeur unique** pour créer, diffuser et
corriger automatiquement des évaluations de **Numérique et Sciences Informatiques**
(Première & Terminale) à l'aide d'un agent IA spécialisé.

## Fonctionnalités

- **Compte professeur unique** (aucun autre compte professeur ne peut être créé).
- **Création d'évaluations** : import du sujet PDF, corrigé officiel facultatif,
  barème sur 20, durée, niveau (Première/Terminale), exercices avec types de
  réponses autorisés, code d'accès généré automatiquement.
- **Accès élève sans inscription** : nom, prénom, classe + code d'accès.
- **Interface d'examen en deux colonnes** : lecteur PDF (PDF.js) à gauche,
  espace de travail à droite, redimensionnable.
- **Cellules de réponse** : Python (éditeur Monaco + exécution Pyodide),
  texte, image, QCM, tableau.
- **Chronomètre, sauvegarde automatique, anti-triche** (changements d'onglet,
  sorties plein écran, pertes de focus — journalisé, sans webcam ni micro).
- **Agent IA spécialisé NSI** : corrige chaque exercice selon le barème, produit
  une note sur 20, une correction détaillée, un bilan de compétences et des
  conseils de progression.
- **PDF de correction** généré automatiquement (pdfkit) et **envoi par e-mail**
  au professeur.
- **Tableau de bord** : statistiques, répartition des notes, table des copies,
  export CSV.

## Stack technique

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4** + **shadcn/ui**
- **Prisma ORM** + **PostgreSQL** (Vercel Postgres / Neon / Supabase)
- **Vercel Blob** pour le stockage des PDF/images
- **PDF.js** (lecteur PDF), **Monaco** (éditeur Python), **Pyodide** (exécution Python)
- **pdfkit** (génération PDF côté serveur), **pdf-parse** (extraction de texte)
- **Agent IA** : Google Gemini (REST, quota gratuit) — ou SDK z-ai-web-dev-sdk en dev local

## Déploiement sur Vercel (site dynamique + base de données)

### 1. Préparer le dépôt
```bash
git init
git add .
git commit -m "PROFNSI — plateforme d'évaluation NSI"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/profnsi.git
git push -u origin main
```

### 2. Créer les ressources sur Vercel
1. Importez le dépôt sur https://vercel.com/new
2. **Base de données** : onglet *Storage → Create → Postgres* (Neon, gratuit).
   Copiez la variable `DATABASE_URL` générée.
3. **Stockage fichiers** : *Storage → Create → Blob*. Copiez
   `BLOB_READ_WRITE_TOKEN`.
4. **Agent IA** : créez une clé gratuite sur
   https://aistudio.google.com/ → copiez `GEMINI_API_KEY`.

### 3. Configurer les variables d'environnement
Dans *Vercel → Project → Settings → Environment Variables*, ajoutez (voir
`.env.example`) :

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne PostgreSQL (Vercel Postgres/Neon) |
| `PROFNSI_USERNAME` | Votre identifiant professeur |
| `PROFNSI_PASSWORD` | Votre mot de passe (fort, personnel) |
| `PROFNSI_SESSION_SECRET` | Secret aléatoire long pour signer les sessions |
| `BLOB_READ_WRITE_TOKEN` | Token Vercel Blob |
| `GEMINI_API_KEY` | Clé Google Gemini (gratuite) |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | SMTP pour l'envoi réel (optionnel — sinon mode simulé) |

### 4. Déployer
- Vercel installe les dépendances et compile automatiquement.
- Après le premier déploiement, initialisez la base :
  ```
  DATABASE_URL=<votre url> npx prisma db push
  ```
  (ou via l'onglet Vercel → cli, ou en local avec votre `.env`)

### 5. Utiliser
1. Connectez-vous avec vos identifiants (`PROFNSI_USERNAME` / `PROFNSI_PASSWORD`).
2. Créez une évaluation, importez le sujet PDF, définissez le barème et les exercices.
3. Générez le code d'accès et **ouvrez** l'examen.
4. Communiquez le code à vos élèves (page d'accueil → *Accès élève*).
5. Les élèves composent, soumettent leur copie.
6. Lancez la **correction IA**, validez/ajustez la note, générez le PDF.
7. Le PDF corrigé est envoyé par e-mail à profnsi27@gmail.com (configurable).

## Développement local

```bash
bun install            # ou npm install
cp .env.example .env   # renseignez DATABASE_URL, BLOB_READ_WRITE_TOKEN, GEMINI_API_KEY…
npx prisma db push
bun run dev
```

Sans `BLOB_READ_WRITE_TOKEN`, le stockage utilise le dossier local `storage/`.
Sans `GEMINI_API_KEY`, l'IA utilise le SDK `z-ai-web-dev-sdk` si disponible.

## Compte professeur par défaut (dev)

Tant que `PROFNSI_USERNAME` / `PROFNSI_PASSWORD` ne sont pas définis :
identifiant `profnsi`, mot de passe `nsi2025`. **Changez-les en production.**

## Architecture

```
src/
  app/
    api/            # routes API (auth, exams, copies, student, settings, stats, upload, file, copy-action)
    page.tsx        # SPA unique (navigation par vues)
  components/profnsi/  # Landing, TeacherLogin, TeacherApp, Dashboard, ExamLibrary,
                       # ExamEditor, CopiesPanel, CopyReview, SettingsPanel,
                       # StudentAccess, ExamRunner, PdfViewer, cells/
  lib/
    ai.ts           # agent IA (Gemini/z-ai) + extraction PDF (pdf-parse)
    auth.ts         # session professeur (token HMAC + cookie)
    storage.ts      # stockage adaptatif (Vercel Blob / local)
    email.ts        # génération PDF (pdfkit) + envoi e-mail (nodemailer)
    file-url.ts     # résolution d'URL de fichier (client-safe)
    db.ts           # client Prisma
    types.ts        # types partagés
prisma/schema.prisma # PostgreSQL
```

## Notes

- L'envoi d'e-mail réel nécessite un SMTP. Sans SMTP, les PDF sont générés et
  téléchargeables depuis l'espace professeur (mode simulé).
- Aucun cookie tiers n'est requis : l'authentification professeur repose sur un
  jeton stocké côté client, envoyé via l'en-tête `x-profnsi-token` (compatible
  iframe / Vercel).
- La clé API IA n'est jamais exposée côté navigateur.
