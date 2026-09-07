import "server-only";

/**
 * Server-only gate for the signals persistence layer (constitution E3). Route
 * handlers and server components import from here; tests and scripts import
 * the modules directly.
 */
export { createDb, ensureSchema, getDb } from "./db";
export { createRepo, signalsRepo, type NewCopy, type NewSignal, type SignalsRepo } from "./repo";
export { loadFeed } from "./feed";
export { describe, groupCopyMarkers, headline, holdLabel, ideaProgress, isExpired, progressSentence, sizeLabel, timeLeftLabel, tpSlPrices } from "./math";
