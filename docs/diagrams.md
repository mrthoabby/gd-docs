# Diagrams

Diagrams are a first-class content type for visual architecture work. They use
the existing BlockSuite edgeless canvas and collaborative Yjs snapshot/update
pipeline, but they are exposed as a separate product type from documents.

## Domain Model

- `document` opens in page mode and should not be converted to a diagram.
- `diagram` opens in edgeless mode and should not be converted to a document.
- `primaryMode` remains as a legacy compatibility field while existing data is
  migrated.
- `contentType` is the product contract. When it is missing, legacy data is
  resolved from `primaryMode`.

## Persistence

The backend migration adds `workspace_pages.content_type` with values:

- `document`
- `diagram`

Backfill maps published legacy edgeless rows to `diagram` and all other rows to
`document`. The frontend workspace database also stores `contentType` in
`docProperties` and writes the matching legacy `primaryMode` for compatibility.

## API Contract

GraphQL exposes `DocContentType` and `DocType.contentType`. Existing clients that
only read `mode` continue to work; new clients should treat `contentType` as the
domain field and `mode` as an editor/open-mode compatibility field.

Frontend creation APIs should prefer:

- `DocsService.createDocument`
- `DocsService.createDiagram`
- `createDoc({ contentType: 'document' | 'diagram' })`

Avoid adding new flows that call `setPrimaryMode` as a user-facing conversion.

## Collaboration

Diagrams intentionally reuse the existing document collaboration stack:

- BlockSuite store and schema
- Yjs root/doc snapshots
- incremental updates
- existing workspace/doc permissions
- existing share/comment infrastructure
- existing analytics and telemetry pipeline with `contentType`

Do not add a parallel diagram storage format unless a future migration plan
explicitly replaces the BlockSuite snapshot contract.

## UX Contract

- Creation must offer Document and Diagram as distinct choices.
- Documents do not expose a canvas bootstrap or mode conversion path.
- Diagrams keep canvas tools such as shapes, connectors, text, grouping, snap,
  zoom, pan, undo/redo, and element styling.
- Diagram insertion surfaces should prioritize diagramming primitives and avoid
  miscellaneous or header-only grouping that does not support diagramming.

## Rollout

Recommended rollout flag: `enable_diagrams_content_type`.

Safe rollout sequence:

1. Ship read compatibility: resolve missing `contentType` from `primaryMode`.
2. Ship creation paths that write both `contentType` and compatible
   `primaryMode`.
3. Run the backend migration and monitor counts by `content_type`.
4. Remove legacy UI copy and conversion commands.
5. In a later release, audit remaining `primaryMode` call sites and narrow them
   to rendering/open-mode compatibility only.

## Verification

Required coverage:

- creating a document stores `contentType=document` and opens in page mode.
- creating a diagram stores `contentType=diagram` and opens in edgeless mode.
- documents cannot be switched to diagrams through header, starter bar, command
  palette, or properties.
- diagrams continue to persist and reopen canvas elements without data loss.
- GraphQL exposes `DocContentType` for workspace docs.
