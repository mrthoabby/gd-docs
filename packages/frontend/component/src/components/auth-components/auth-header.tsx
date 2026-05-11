import clsx from 'clsx';
import type { FC } from 'react';

import { ProductLogoIcon } from '../../ui/product-logo';
import { authHeaderWrapper } from './share.css';

export const AuthHeader: FC<{
  title: string;
  subTitle?: string;
  className?: string;
}> = ({ title, subTitle, className }) => {
  return (
    <div className={clsx(authHeaderWrapper, className)}>
      <p>
        <ProductLogoIcon className="logo" />
        {title}
      </p>
      <p>{subTitle}</p>
    </div>
  );
};
