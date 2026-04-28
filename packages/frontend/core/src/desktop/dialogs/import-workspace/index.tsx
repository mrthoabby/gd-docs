import { toast } from '@affine/component';
import {
  type DialogComponentProps,
  type GLOBAL_DIALOG_SCHEMA,
} from '@affine/core/modules/dialogs';
import { useLayoutEffect, useRef } from 'react';

export const ImportWorkspaceDialog = ({
  close,
}: DialogComponentProps<GLOBAL_DIALOG_SCHEMA['import-workspace']>) => {
  const effectRef = useRef(false);

  // TODO(@Peng): maybe refactor using xstate?
  useLayoutEffect(() => {
    if (effectRef.current) {
      return;
    }
    effectRef.current = true;

    toast('Workspace file import is unavailable in the web-only build.');
    close();
  }, [close]);

  return null;
};
