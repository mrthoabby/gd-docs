import {
  Input,
  Menu,
  MenuItem,
  type MenuProps,
  MenuSeparator,
  Scrollable,
} from '@affine/component';
import { useI18n } from '@affine/i18n';
import { DeleteIcon, TagsIcon } from '@blocksuite/icons/rc';
import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';

import * as styles from './tag-edit-menu.css';
import type { TagColor, TagLike } from './types';

type TagEditMenuProps = PropsWithChildren<{
  onTagDelete: (tagId: string) => void;
  colors: TagColor[];
  tag: TagLike;
  onTagChange: (property: keyof TagLike, value: string) => void;
  jumpToTag?: (tagId: string) => void;
}>;

const DesktopTagEditMenu = ({
  tag,
  onTagDelete,
  children,
  jumpToTag,
  colors,
  onTagChange,
}: TagEditMenuProps) => {
  const t = useI18n();

  const menuProps = useMemo(() => {
    const updateTagName = (name: string) => {
      if (name.trim() === '') {
        return;
      }
      onTagChange('name', name);
    };

    return {
      contentOptions: {
        onClick(e) {
          e.stopPropagation();
        },
      },
      items: (
        <>
          <Input
            defaultValue={tag.name}
            onBlur={e => {
              updateTagName(e.currentTarget.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                updateTagName(e.currentTarget.value);
              }
              e.stopPropagation();
            }}
            placeholder={t['Untitled']()}
          />
          <MenuSeparator />
          <MenuItem
            prefixIcon={<DeleteIcon />}
            type="danger"
            onClick={() => onTagDelete(tag.id)}
          >
            {t['Delete']()}
          </MenuItem>
          {jumpToTag ? (
            <MenuItem
              prefixIcon={<TagsIcon />}
              onClick={() => {
                jumpToTag(tag.id);
              }}
            >
              {t['com.affine.page-properties.tags.open-tags-page']()}
            </MenuItem>
          ) : null}
          <MenuSeparator />
          <Scrollable.Root>
            <Scrollable.Viewport className={styles.menuItemList}>
              {colors.map(({ name, value: color }) => (
                <MenuItem
                  key={color}
                  checked={tag.color === color}
                  prefixIcon={
                    <div className={styles.tagColorIconWrapper}>
                      <div
                        className={styles.tagColorIcon}
                        style={{
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  }
                  onClick={() => {
                    onTagChange('color', color);
                  }}
                >
                  {name}
                </MenuItem>
              ))}
              <Scrollable.Scrollbar className={styles.menuItemListScrollbar} />
            </Scrollable.Viewport>
          </Scrollable.Root>
        </>
      ),
    } satisfies Partial<MenuProps>;
  }, [tag, t, jumpToTag, colors, onTagChange, onTagDelete]);

  return <Menu {...menuProps}>{children}</Menu>;
};

export const TagEditMenu = DesktopTagEditMenu;
