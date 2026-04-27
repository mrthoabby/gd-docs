import { Service } from '@toeverything/infra';

import type { DesktopApiProvider } from '../provider';

export class ElectronApiImpl extends Service implements DesktopApiProvider {
  handler = {
    ui: {
      getTabViewsMeta: async () => ({ workbenches: [] }),
      tabGoTo: async () => {},
      showTab: async () => {},
      isMaximized: async () => false,
      isFullScreen: async () => false,
      isActiveTab: async () => true,
      handleWindowResize: async () => {},
      onLanguageChange: async () => {},
      restartApp: async () => {},
      captureArea: async () => {},
    },
    recording: {
      checkRecordingAvailable: async () => false,
      checkMeetingPermissions: async () => ({ screen: false, microphone: false }),
      askForMeetingPermission: async () => {},
      showRecordingPermissionSetting: async () => {},
      setupRecordingFeature: async () => false,
      disableRecordingFeature: async () => {},
      getCurrentRecording: async () => null,
      showSavedRecordings: async () => {},
    },
    configStorage: {
      get: async () => null,
      set: async () => {},
    },
    updater: {
      currentVersion: async () => BUILD_CONFIG.appVersion,
      checkForUpdates: async () => null,
      downloadUpdate: async () => {},
      quitAndInstall: async () => {},
    },
  };

  events = {
    ui: {
      onMaximized: () => () => {},
      onFullScreen: () => () => {},
      onActiveTabChanged: () => () => {},
      onAuthenticationRequest: () => () => {},
    },
    updater: {
      onUpdateReady: () => () => {},
      onUpdateAvailable: () => () => {},
      onDownloadProgress: () => () => {},
    },
  };

  sharedStorage = {
    get: async () => undefined,
    set: async () => {},
    watch: () => () => {},
  };

  appInfo = {
    windowName: 'web',
  };
}
