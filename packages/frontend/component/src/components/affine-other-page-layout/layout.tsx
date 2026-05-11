import { Button } from '@affine/component/ui/button';
import { useI18n } from '@affine/i18n';
import { useTheme } from 'next-themes';
import { type ReactNode, useCallback } from 'react';

import { ProductLogoIcon } from '../../ui/product-logo';
import crystalBackground from './assets/crystal-background.png';
import { DesktopNavbar } from './desktop-navbar';
import * as styles from './index.css';

export const AffineOtherPageLayout = ({
  children,
}: {
  children: ReactNode;
}) => {
  const t = useI18n();
  const downloadUrl = BUILD_CONFIG.downloadUrl;

  const openDownloadLink = useCallback(() => {
    if (!downloadUrl) {
      return;
    }
    globalThis.open(downloadUrl, '_blank', 'noopener,noreferrer');
  }, [downloadUrl]);

  const { resolvedTheme } = useTheme();
  const backgroundOverlay =
    resolvedTheme === 'dark'
      ? 'linear-gradient(90deg, rgba(5, 8, 13, 0.84) 0%, rgba(5, 8, 13, 0.64) 45%, rgba(5, 8, 13, 0.38) 100%)'
      : 'linear-gradient(90deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.58) 45%, rgba(255, 255, 255, 0.26) 100%)';

  return (
    <div
      className={styles.root}
      style={{
        backgroundImage: `${backgroundOverlay}, url(${crystalBackground})`,
      }}
    >
      {BUILD_CONFIG.isElectron ? (
        <div className={styles.draggableHeader} />
      ) : (
        <div className={styles.topNav}>
          <a href="/" rel="noreferrer" className={styles.affineLogo}>
            <ProductLogoIcon width={24} height={24} />
          </a>

          <DesktopNavbar />
          {downloadUrl ? (
            <Button
              onClick={openDownloadLink}
              className={styles.hideInSmallScreen}
            >
              {t['com.affine.other-page.nav.download-app']()}
            </Button>
          ) : null}
        </div>
      )}

      {children}
    </div>
  );
};
