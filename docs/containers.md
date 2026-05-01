# Workspace Containers

Containers are workspace-scoped folder items used to group non-document files:
images, text files, and PDFs. They are server-backed entities linked into the
local Organize tree as `container` folder nodes.

## Architecture

- `WorkspaceContainer` stores the product entity, lifecycle state, audit fields,
  and best-effort restore metadata for the Organize tree.
- `WorkspaceContainerFile` stores file metadata and points at the existing
  workspace blob storage by `blobKey`.
- Blob keys are namespaced as
  `containers/{containerId}/{fileId}/r{revision}-{safeName}`.
- Text edits create a new blob key and increment `revision`, so old browser
  caches cannot serve stale content.
- REST content is served through
  `/api/workspaces/:workspaceId/containers/:containerId/files/:fileId/content`
  with private cache headers and revision-based ETags.

## Permissions

Container reads, writes, and deletes use workspace permissions:

- `Workspace.Containers.Read`
- `Workspace.Containers.Write`
- `Workspace.Containers.Delete`

These permissions are granted to normal workspace collaborators and above.
Containers are not exposed through public document sharing.

## Validation

Accepted files:

- Images: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`
- Text: `.md`, `.txt`, `.nb`
- PDFs: `.pdf`

The backend validates file name, extension, MIME, size, and a small content
signature. Image extensions must match their MIME exactly; text files must
decode as UTF-8 and are limited to 5 MiB. Image and PDF limits follow the
existing workspace blob quota.

## Design Decisions

- Containers reuse workspace blob storage instead of introducing a second file
  storage system.
- Files are soft-deleted in metadata and blob cleanup follows the existing blob
  lifecycle.
- Presigned and multipart uploads are supported through the existing storage
  provider interfaces. Direct GraphQL upload remains the fallback.
- Restore into Organize is best effort because the folder tree is local/Yjs
  state. Missing original folders fall back to a root restore folder.

## Risks and Mitigations

- Backend and Organize tree can drift if a local folder link fails after server
  creation. Creation rolls the server container into trash on link failure.
- Text previews can stale-cache after edits. Each save writes a new blob key and
  bumps `revision`.
- Large text files can lock the modal editor. Editable text is capped at 5 MiB.
- Direct public-document links do not grant container access; REST serving
  checks workspace container permissions.

## Rollout

The UI is controlled by the workspace feature flag `enable_containers`. It is
enabled by default for self-hosted workspaces. Disabling the flag hides creation
entry points while keeping existing data intact.

Deployment requires:

1. Run the Prisma migration that creates container tables and enums.
2. Regenerate Prisma client.
3. Deploy backend and frontend together because the Organize node type and
   route `/container/:containerId` are introduced in the same change.

Rollback:

1. Disable `enable_containers` to hide the UI.
2. Keep the migration in place. Existing container rows and blobs remain
   recoverable for a future rollout.

## Acceptance Notes

- Folder menus create containers under the current folder.
- The Organize tree stores the container link locally while the container record
  lives in the server database.
- Trashing a container removes the Organize link and moves the server entity to
  `trashed`.
- Restoring relinks to the original folder when possible. If that folder no
  longer exists, the UI creates or reuses a root folder named "Restored
  containers".
- Images preview in a modal with zoom and image-to-image navigation.
- PDFs preview in an inline modal frame.
- Text files edit in a modal and save with revision conflict protection.
