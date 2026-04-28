import { LiveData, Service } from '@toeverything/infra';
import { defaults } from 'lodash-es';

import type { GlobalStateService } from '../../storage';

export type MeetingSettingsSchema = {
  enabled: boolean;
  betaDisclaimerAccepted: boolean;
  recordingSavingMode: 'new-doc' | 'append-current-doc';
  autoTranscriptionSummary: boolean;
  autoTranscriptionTodo: boolean;
  recordingMode: 'prompt' | 'auto-start' | 'none';
};

const MEETING_SETTINGS_KEY = 'meetingSettings';

const defaultMeetingSettings: MeetingSettingsSchema = {
  enabled: false,
  betaDisclaimerAccepted: false,
  recordingSavingMode: 'new-doc',
  autoTranscriptionSummary: true,
  autoTranscriptionTodo: true,
  recordingMode: 'prompt',
};

export class MeetingSettingsService extends Service {
  constructor(private readonly globalStateService: GlobalStateService) {
    super();
  }

  readonly settings$ = LiveData.computed(get => {
    const value = get(
      LiveData.from(
        this.globalStateService.globalState.watch<MeetingSettingsSchema>(
          MEETING_SETTINGS_KEY
        ),
        undefined
      )
    );
    return defaults(value, defaultMeetingSettings);
  });

  get settings() {
    return this.settings$.value;
  }

  setRecordingSavingMode(mode: MeetingSettingsSchema['recordingSavingMode']) {
    this.globalStateService.globalState.set(MEETING_SETTINGS_KEY, {
      ...this.settings$.value,
      recordingSavingMode: mode,
    });
  }

  setAutoSummary(autoSummary: boolean) {
    this.globalStateService.globalState.set(MEETING_SETTINGS_KEY, {
      ...this.settings$.value,
      autoTranscriptionSummary: autoSummary,
    });
  }

  setAutoTodo(autoTodo: boolean) {
    this.globalStateService.globalState.set(MEETING_SETTINGS_KEY, {
      ...this.settings$.value,
      autoTranscriptionTodo: autoTodo,
    });
  }

  setRecordingMode = (mode: MeetingSettingsSchema['recordingMode']) => {
    const currentMode = this.settings.recordingMode;

    if (currentMode === mode) {
      return;
    }

    this.globalStateService.globalState.set(MEETING_SETTINGS_KEY, {
      ...this.settings,
      recordingMode: mode,
    });
  };

}
