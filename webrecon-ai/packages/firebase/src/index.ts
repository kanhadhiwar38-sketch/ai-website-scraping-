/**
 * Deliberately does NOT re-export ./client or ./admin here. Consumers must
 * import "@webrecon/firebase/client" or "@webrecon/firebase/admin"
 * explicitly, so it's always obvious at the import site which one (and
 * therefore which bundle: browser vs server-only) is being used.
 */
export * from "./paths.js";
