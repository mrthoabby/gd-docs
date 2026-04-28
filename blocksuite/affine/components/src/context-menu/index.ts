import { MenuButton } from './button';
import { MenuInput } from './input';
import { MenuDivider } from './menu-divider';
import { MenuComponent } from './menu-renderer';
import { MenuSubMenu } from './sub-menu';

export * from './button';
export * from './focusable';
export * from './group';
export * from './input';
export * from './item';
export * from './menu';
export * from './menu-all';
export * from './menu-divider';
export * from './menu-renderer';
export * from './sub-menu';

export function effects() {
  customElements.define('affine-menu', MenuComponent);
  customElements.define('affine-menu-button', MenuButton);
  customElements.define('affine-menu-input', MenuInput);
  customElements.define('affine-menu-sub-menu', MenuSubMenu);
  customElements.define('menu-divider', MenuDivider);
}

export * from './types.js';
