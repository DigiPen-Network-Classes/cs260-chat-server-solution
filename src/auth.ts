import { readFileSync } from "fs";
import Log from "./logger";

/**
 * Resolve the auth token. Prefer the `AUTH_TOKEN` env var; otherwise fall back
 * to reading it from the file named by `AUTH_TOKEN_FILE` (Docker secrets mount
 * the value at e.g. /run/secrets/chat-auth-token). Exit if neither is usable.
 */
function resolveAuthToken(): string {
    const inline = process.env.AUTH_TOKEN;
    if (inline) {
        return inline;
    }

    const file = process.env.AUTH_TOKEN_FILE;
    if (file) {
        try {
            const token = readFileSync(file, "utf8").trim();
            if (token) {
                return token;
            }
            Log.fatal(`AUTH_TOKEN_FILE (${file}) is empty`);
        } catch (err) {
            Log.fatal(`Failed to read AUTH_TOKEN_FILE (${file}): ${err}`);
        }
    } else {
        Log.fatal("AUTH_TOKEN is not set and AUTH_TOKEN_FILE is not set");
    }

    process.exit(1);
}

export const AUTH_TOKEN = resolveAuthToken();