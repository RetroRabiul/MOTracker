/// <reference types="vite/client" />

/**
 * Set by the build to true when a published APK exists at `public/app.apk`.
 * The download button is only rendered when there is genuinely a file to
 * serve, instead of promising a download that 404s.
 */
declare const __APK_PUBLISHED__: boolean;
