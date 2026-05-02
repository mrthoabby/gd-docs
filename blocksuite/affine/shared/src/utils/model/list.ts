import { ListBlockModel } from '@blocksuite/affine-model';
import type { BlockStdScope } from '@blocksuite/std';
import type { BlockModel, Store } from '@blocksuite/store';

import { matchModels } from './checker.js';

export type OrderedListType = 'numbered' | 'phase';

export function isOrderedListType(type: unknown): type is OrderedListType {
  return type === 'numbered' || type === 'phase';
}

function isSameOrderedList(
  model: BlockModel,
  type: OrderedListType
): model is ListBlockModel {
  return matchModels(model, [ListBlockModel]) && model.props.type === type;
}

export function getPreviousOrderedList(
  doc: Store,
  modelOrId: BlockModel | string,
  type: OrderedListType = 'numbered'
): ListBlockModel | null {
  const model =
    typeof modelOrId === 'string' ? doc.getBlock(modelOrId)?.model : modelOrId;
  if (!model) return null;

  const parent = doc.getParent(model);
  if (!parent) return null;

  const modelIndex = parent.children.indexOf(model);
  if (modelIndex === -1) return null;

  if (type !== 'phase') {
    const previousSibling =
      modelIndex > 0 ? parent.children[modelIndex - 1] : null;
    return previousSibling && isSameOrderedList(previousSibling, type)
      ? previousSibling
      : null;
  }

  for (let i = modelIndex - 1; i >= 0; i--) {
    const sibling = parent.children[i];
    if (isSameOrderedList(sibling, type)) {
      return sibling;
    }
  }

  return null;
}

/**
 * Pass in a model, and this function will look forward to find continuous sibling ordered lists,
 * typically used for updating list numbers. The result not contains the list passed in.
 */
export function getNextContinuousOrderedLists(
  doc: Store,
  modelOrId: BlockModel | string,
  type: OrderedListType = 'numbered'
): ListBlockModel[] {
  const model =
    typeof modelOrId === 'string' ? doc.getBlock(modelOrId)?.model : modelOrId;
  if (!model) return [];
  const parent = doc.getParent(model);
  if (!parent) return [];
  const modelIndex = parent.children.indexOf(model);
  if (modelIndex === -1) return [];

  if (type === 'phase') {
    return parent.children
      .slice(modelIndex + 1)
      .filter(model => isSameOrderedList(model, type));
  }

  const firstNotNumberedListIndex = parent.children.findIndex(
    (model, i) =>
      i > modelIndex &&
      (!isSameOrderedList(model, type))
  );
  const newContinuousLists = parent.children.slice(
    modelIndex + 1,
    firstNotNumberedListIndex === -1 ? undefined : firstNotNumberedListIndex
  );
  if (
    !newContinuousLists.every(
      model => matchModels(model, [ListBlockModel]) && model.props.type === type
    )
  )
    return [];

  return newContinuousLists as ListBlockModel[];
}

export function getNextContinuousNumberedLists(
  doc: Store,
  modelOrId: BlockModel | string
): ListBlockModel[] {
  return getNextContinuousOrderedLists(doc, modelOrId, 'numbered');
}

export function toOrderedList(
  std: BlockStdScope,
  model: BlockModel,
  order: number,
  type: OrderedListType
) {
  const { store: doc } = std;
  if (!model.text) return;
  const parent = doc.getParent(model);
  if (!parent) return;
  const index = parent.children.indexOf(model);
  const prevList = getPreviousOrderedList(doc, model, type);
  let realOrder = order;

  // if there is a numbered list before, the order continues from the previous list
  if (prevList) {
    doc.transact(() => {
      if (!prevList.props.order) prevList.props.order = 1;
      realOrder = prevList.props.order + 1;
    });
  }

  // add a new list block and delete the current block
  const newListId = doc.addBlock(
    'affine:list',
    {
      type,
      text: model.text.clone(),
      order: realOrder,
    },
    parent,
    index
  );
  const newList = doc.getBlock(newListId)?.model;
  if (!newList) {
    return;
  }

  doc.deleteBlock(model, {
    deleteChildren: false,
    bringChildrenTo: newList,
  });

  // if there is a numbered list following, correct their order to keep them continuous
  const nextContinuousNumberedLists = getNextContinuousOrderedLists(
    doc,
    newList,
    type
  );
  let base = realOrder + 1;
  nextContinuousNumberedLists.forEach(list => {
    doc.transact(() => {
      if (type === 'phase' && list.props.phaseSequenceStart) {
        list.props.order = 1;
        base = 2;
      } else {
        list.props.order = base;
        base += 1;
      }
    });
  });

  return newList.id;
}

export function toNumberedList(
  std: BlockStdScope,
  model: BlockModel,
  order: number
) {
  return toOrderedList(std, model, order, 'numbered');
}
