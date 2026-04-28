import { AuthService } from '@affine/core/modules/cloud';
import type { DocMode } from '@blocksuite/affine/model';
import { useLiveData, useService } from '@toeverything/infra';

import { PresentButton } from './present';
import { SignIn } from './sign-in';
import * as styles from './styles.css';
import { PublishPageUserAvatar } from './user-avatar';

export type ShareHeaderRightItemProps = {
  publishMode: DocMode;
};

const ShareHeaderRightItem = ({ publishMode }: ShareHeaderRightItemProps) => {
  const loginStatus = useLiveData(useService(AuthService).session.status$);
  const authenticated = loginStatus === 'authenticated';
  return (
    <div className={styles.rightItemContainer}>
      {authenticated ? null : <SignIn />}
      {publishMode === 'edgeless' ? <PresentButton /> : null}
      {authenticated ? (
        <>
          <div
            className={styles.headerDivider}
            data-authenticated={true}
            data-is-edgeless={publishMode === 'edgeless'}
          />
          <PublishPageUserAvatar />
        </>
      ) : null}
    </div>
  );
};

export default ShareHeaderRightItem;
