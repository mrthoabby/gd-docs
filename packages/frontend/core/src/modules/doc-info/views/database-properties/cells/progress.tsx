import { Progress, PropertyValue } from '@affine/component';
import type { LiveData } from '@toeverything/infra';
import { useLiveData } from '@toeverything/infra';
import { useEffect, useState } from 'react';

import type { DatabaseCellRendererProps } from '../../../types';

const DesktopProgressCell = ({
  cell,
  dataSource,
  rowId,
  onChange,
}: DatabaseCellRendererProps) => {
  const value = useLiveData(cell.value$ as LiveData<number>);
  const [localValue, setLocalValue] = useState(value || 0);

  useEffect(() => {
    setLocalValue(value || 0);
  }, [value]);

  return (
    <PropertyValue hoverable={false}>
      <Progress
        value={localValue}
        onChange={v => {
          setLocalValue(v);
        }}
        onBlur={() => {
          dataSource.cellValueChange(rowId, cell.id, localValue);
          onChange?.(localValue);
        }}
      />
    </PropertyValue>
  );
};

export const ProgressCell = DesktopProgressCell;
