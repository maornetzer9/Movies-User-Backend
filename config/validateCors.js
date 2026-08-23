function validateCorsOrigin() {
    const origin = process.env.ORIGIN;

    if (!origin) {
        return;
    }

    if (origin === '*') {
        console.warn('[CORS] WARNING: ORIGIN is "*" — allows any origin. Use an explicit URL in production.');
    }

    if (!/^https?:\/\//i.test(origin.trim())) {
        console.warn(
            `[CORS] WARNING: ORIGIN "${origin}" does not look like a valid URL (expected http:// or https://).`
        );
    }

    if (origin.includes(',')) {
        console.warn(
            '[CORS] WARNING: ORIGIN contains commas. cors() expects a single origin string or a function — verify configuration.'
        );
    }
}

module.exports = { validateCorsOrigin };
