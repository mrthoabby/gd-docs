import type { FC, PropsWithChildren } from 'react';
import { useCallback } from 'react';
import { ErrorBoundary, type FallbackRender } from 'react-error-boundary';

import { AffineErrorFallback } from './affine-error-fallback';

export { type FallbackProps } from './error-basic/fallback-creator';

export interface AffineErrorBoundaryProps extends PropsWithChildren {
  height?: number | string;
  className?: string;
}

/**
 * TODO(@eyhn): Unify with SWRErrorBoundary
 */
export const AffineErrorBoundary: FC<AffineErrorBoundaryProps> = props => {
  const fallbackRender: FallbackRender = useCallback(
    fallbackProps => {
      return (
        <AffineErrorFallback
          {...fallbackProps}
          height={props.height}
          className={props.className}
        />
      );
    },
    [props.height, props.className]
  );

  const onError = useCallback((error: unknown, componentStack?: string) => {
    console.error('Uncaught error:', error, componentStack);
  }, []);

  return (
    <ErrorBoundary fallbackRender={fallbackRender} onError={onError}>
      {props.children}
    </ErrorBoundary>
  );
};
