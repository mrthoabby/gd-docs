import { AFFINE_LINKED_DOC_WIDGET } from './config.js';
import { ImportDoc } from './import-doc/import-doc.js';
import { Loader } from './import-doc/loader.js';
import { AffineLinkedDocWidget } from './index.js';
import { LinkedDocPopover } from './linked-doc-popover.js';

export function effects() {
  customElements.define('affine-linked-doc-popover', LinkedDocPopover);
  customElements.define(AFFINE_LINKED_DOC_WIDGET, AffineLinkedDocWidget);
  customElements.define('import-doc', ImportDoc);
  customElements.define('loader-element', Loader);
}
