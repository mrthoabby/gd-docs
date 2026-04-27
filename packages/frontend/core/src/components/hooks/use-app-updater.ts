// todo(@pengx17): remove jotai
import { UrlService } from '@affine/core/modules/url';
import { track } from '@affine/track';
import { appSettingAtom, useService } from '@toeverything/infra';
import { atom, useAtom, useAtomValue } from 'jotai';
import { atomWithObservable, atomWithStorage } from 'jotai/utils';
import { useCallback, useState } from 'react';
import { Observable } from 'rxjs';

import { useAsyncCallback } from './affine-async-hooks';

type UpdateMeta = {
  version: string;
};

function rpcToObservable<T>(initialValue: T | null): Observable<T | null> {
  return new Observable<T | null>(subscriber => {
    subscriber.next(initialValue);
    subscriber.complete();
  });
}

// download complete, ready to install
export const updateReadyAtom = atomWithObservable(() => {
  return rpcToObservable(null as UpdateMeta | null);
});

// update available, but not downloaded yet
export const updateAvailableAtom = atomWithObservable(() => {
  return rpcToObservable(null as UpdateMeta | null);
});

// downloading new update
export const downloadProgressAtom = atomWithObservable(() => {
  return rpcToObservable(null as number | null);
});

export const changelogCheckedAtom = atomWithStorage<Record<string, boolean>>(
  'affine:client-changelog-checked',
  {}
);

export const checkingForUpdatesAtom = atom(false);

export const currentVersionAtom = atom(async () => {
  return BUILD_CONFIG.appVersion;
});

const currentChangelogUnreadAtom = atom(
  async get => {
    const mapping = get(changelogCheckedAtom);
    const currentVersion = await get(currentVersionAtom);
    if (currentVersion) {
      return !mapping[currentVersion];
    }
    return false;
  },
  async (get, set, v: boolean) => {
    const currentVersion = await get(currentVersionAtom);
    if (currentVersion) {
      set(changelogCheckedAtom, mapping => {
        return {
          ...mapping,
          [currentVersion]: v,
        };
      });
    }
  }
);

export const useAppUpdater = () => {
  const [appQuitting, setAppQuitting] = useState(false);
  const updateReady = useAtomValue(updateReadyAtom);
  const urlService = useService(UrlService);
  const [setting, setSetting] = useAtom(appSettingAtom);
  const downloadProgress = useAtomValue(downloadProgressAtom);
  const [changelogUnread, setChangelogUnread] = useAtom(
    currentChangelogUnreadAtom
  );

  const [checkingForUpdates, setCheckingForUpdates] = useAtom(
    checkingForUpdatesAtom
  );

  const quitAndInstall = useCallback(() => {
    track.$.navigationPanel.bottomButtons.quitAndInstall();
    if (updateReady) {
      setAppQuitting(true);
    }
  }, [updateReady]);

  const checkForUpdates = useCallback(async () => {
    track.$.settingsPanel.about.checkUpdates();
    if (checkingForUpdates) {
      return;
    }
    setCheckingForUpdates(true);
    try {
      return false;
    } catch (err) {
      console.error('Error checking for updates:', err);
      return null;
    } finally {
      setCheckingForUpdates(false);
    }
  }, [checkingForUpdates, setCheckingForUpdates]);

  const downloadUpdate = useCallback(() => {
    track.$.settingsPanel.about.downloadUpdate();
  }, []);

  const toggleAutoDownload = useCallback(
    (enable: boolean) => {
      track.$.settingsPanel.about.changeAppSetting({
        key: 'autoDownload',
        value: enable,
      });
      setSetting({
        autoDownloadUpdate: enable,
      });
    },
    [setSetting]
  );

  const toggleAutoCheck = useCallback(
    (enable: boolean) => {
      track.$.settingsPanel.about.changeAppSetting({
        key: 'autoCheckUpdates',
        value: enable,
      });
      setSetting({
        autoCheckUpdate: enable,
      });
    },
    [setSetting]
  );

  const openChangelog = useAsyncCallback(async () => {
    track.$.navigationPanel.bottomButtons.openChangelog();
    urlService.openPopupWindow(BUILD_CONFIG.changelogUrl);
    await setChangelogUnread(true);
  }, [setChangelogUnread, urlService]);

  const dismissChangelog = useAsyncCallback(async () => {
    track.$.navigationPanel.bottomButtons.dismissChangelog();
    await setChangelogUnread(true);
  }, [setChangelogUnread]);

  return {
    quitAndInstall,
    checkForUpdates,
    downloadUpdate,
    toggleAutoDownload,
    toggleAutoCheck,
    appQuitting,
    checkingForUpdates,
    autoCheck: setting.autoCheckUpdate,
    autoDownload: setting.autoDownloadUpdate,
    changelogUnread,
    openChangelog,
    dismissChangelog,
    updateReady,
    updateAvailable: useAtomValue(updateAvailableAtom),
    downloadProgress,
    currentVersion: useAtomValue(currentVersionAtom),
  };
};
