/**
 * `@capacitor/cli` is only needed when you actually build the app shell:
 *   npm i -D @capacitor/cli @capacitor/core @capacitor/android
 * The type is declared locally so `tsc` stays clean without that install.
 */
type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    url?: string;
    cleartext?: boolean;
    androidScheme?: "http" | "https";
    allowNavigation?: string[];
  };
  android?: Record<string, unknown>;
  ios?: Record<string, unknown>;
  plugins?: Record<string, Record<string, unknown>>;
};

/**
 * Capacitor shell for the "বিশ্বাস এগ্রো" Android app.
 *
 * The WebView loads the deployed site (server.url) rather than a bundled
 * export, because the app depends on Server Components, API routes and the
 * live-stream proxy. That keeps one codebase and instant updates.
 *
 *   npx cap add android
 *   npx cap sync android
 *   npx cap open android
 *
 * For a fully offline bundle, run `next build` with `output: "export"` in a
 * separate config and point webDir at that folder instead.
 */
const config: CapacitorConfig = {
  appId: "com.bishwasagro.app",
  appName: "বিশ্বাস এগ্রো",
  webDir: "public",
  bundledWebRuntime: false,

  server: {
    // Production app → the live site. Swap to http://10.0.2.2:3000 for the
    // Android emulator against a local dev server.
    url: process.env.CAPACITOR_SERVER_URL || "https://bishwasagro.com",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["bishwasagro.com", "*.bishwasagro.com", "*.supabase.co"],
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#111312",
  },

  ios: {
    contentInset: "always",
    backgroundColor: "#111312",
    limitsNavigationsToAppBoundDomains: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#111312",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#111312",
    },
  },
};

export default config;
