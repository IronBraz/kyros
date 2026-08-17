/**
 * Loads `.env.local` into process.env for the local scripts (db:apply, db:seed, smoke).
 *
 * Import it for the side effect, first, before anything reads process.env:
 *
 *   import './load-env.js';
 *
 * Why this exists: db-seed and db-apply told the user to "put it in .env.local" and then
 * nothing read the file, so the only way to run them was to export every variable into the
 * shell by hand. `vercel env pull` writes .env.local, so honouring it is the obvious thing.
 *
 * NOT used by server/ -- on Vercel the platform injects the variables and a serverless
 * function has no .env.local to read.
 *
 * An already-set variable always wins, so an explicit
 * `$env:DATABASE_URL = "..."` still overrides the file for a one-off run against another
 * database. Missing file is not an error: on CI the variables come from the environment.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    if (key in process.env) continue;

    // `vercel env pull` quotes every value. Strip one matching pair, nothing else: the
    // values here are connection strings and secrets, not shell fragments to interpret.
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
