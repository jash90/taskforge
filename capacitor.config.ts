import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'pl.taskforge.app',
  appName: 'TaskForge',
  webDir: 'dist',
  ios: {
    scheme: 'TaskForge',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
