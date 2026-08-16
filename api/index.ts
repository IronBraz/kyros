// Vercel entry point. Everything in api/ that does not start with "_" becomes an HTTP
// function, so the actual backend lives in server/ at the repo root and this file is only
// a shim. All routing happens inside the single Hono app.
import { handle } from 'hono/vercel';
import app from '../server/app.js';

export const config = { runtime: 'nodejs' };

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
