import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sanad.app",
  appName: "Sanad - سند",
  webDir: "dist/public",
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#FFF3E0",
  },
  ios: {
    backgroundColor: "#FFF3E0",
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
