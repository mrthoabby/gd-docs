import { AffineText } from './nodes/affine-text';
import {
  AffinePillSelectMenu,
  AffinePillSelectNode,
} from './pill-select/pill-select-node';

export function effects() {
  customElements.define('affine-text', AffineText);
  customElements.define('affine-pill-select-node', AffinePillSelectNode);
  customElements.define('affine-pill-select-menu', AffinePillSelectMenu);
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-text': AffineText;
    'affine-pill-select-menu': AffinePillSelectMenu;
    'affine-pill-select-node': AffinePillSelectNode;
  }
}
