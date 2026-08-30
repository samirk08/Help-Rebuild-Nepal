/**
 * Shared between server routes (`lib/supabase.ts`) and browser upload code
 * (`lib/uploads.ts`) — kept in its own file so the browser bundle never needs
 * to import anything that also touches the service role key.
 */
export const DOCUMENTS_BUCKET = "submissions";
