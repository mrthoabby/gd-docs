import { Button, type ButtonProps } from '@affine/component';
import clsx from 'clsx';

import { actionButton, actionContent } from './style.css';

export const ActionButton = ({
  className,
  contentClassName,
  ...props
}: ButtonProps) => {
  return (
    <Button
      size="large"
      className={clsx(actionButton, className)}
      contentClassName={clsx(actionContent, contentClassName)}
      {...props}
    />
  );
};
