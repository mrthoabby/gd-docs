import type {
  PillSelectData,
  PillSelectOption,
} from '@blocksuite/affine-shared/types';

export const PILL_SELECT_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
] as const;

export function createPillSelectId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );
}

export function sanitizePillSelectLabel(label: string) {
  const trimmed = label.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, 80) : 'Untitled';
}

export function createPillSelectOption(
  label: string,
  color = PILL_SELECT_COLORS[0]
): PillSelectOption {
  return {
    id: createPillSelectId(),
    label: sanitizePillSelectLabel(label),
    color,
  };
}

export function createDefaultPillSelect(): PillSelectData {
  return {
    id: createPillSelectId(),
    selectedOptionId: null,
    options: [],
    mode: 'copy',
  };
}

export function normalizePillSelect(
  data?: PillSelectData | null
): PillSelectData {
  if (!data) {
    return createDefaultPillSelect();
  }

  const options =
    data.options.length > 0
      ? data.options.map((option, index) => ({
          ...option,
          id: option.id || createPillSelectId(),
          label: sanitizePillSelectLabel(option.label),
          color:
            option.color || PILL_SELECT_COLORS[index % PILL_SELECT_COLORS.length],
        }))
      : [];

  const selectedOptionId = options.some(
    option => option.id === data.selectedOptionId
  )
    ? data.selectedOptionId
    : null;

  return {
    id: data.id || createPillSelectId(),
    selectedOptionId,
    options,
    mode: data.mode === 'reference' ? 'reference' : 'copy',
  };
}

export function getSelectedPillSelectOption(data: PillSelectData) {
  const normalized = normalizePillSelect(data);
  return normalized.options.find(
    option => option.id === normalized.selectedOptionId
  );
}

export function getNextPillSelectColor(color: string) {
  const currentIndex = PILL_SELECT_COLORS.findIndex(value => value === color);
  return PILL_SELECT_COLORS[
    (currentIndex + 1) % PILL_SELECT_COLORS.length
  ];
}
