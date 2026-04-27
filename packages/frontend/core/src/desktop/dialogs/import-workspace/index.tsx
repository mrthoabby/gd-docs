import { toast } from '@affine/component';
import {
  type DialogComponentProps,
  type GLOBAL_DIALOG_SCHEMA,
} from '@affine/core/modules/dialogs';
import { useI18n } from '@affine/i18n';
import { useLayoutEffect, useRef } from 'react';

export const ImportWorkspaceDialog = ({
  close,
}: DialogComponentProps<GLOBAL_DIALOG_SCHEMA['import-workspace']>) => {
  const effectRef = useRef(false);
  const t = useI18n();

  // TODO(@Peng): maybe refactor using xstate?
  useLayoutEffect(() => {
    if (effectRef.current) {
      return;
    }
    effectRef.current = true;

    toast(t['com.affine.import.import-failed']?.() ?? 'Import is unavailable');
    close();
  }, [close, t]);

  return null;
};
