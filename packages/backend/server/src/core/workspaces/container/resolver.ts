import { UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Parent,
  Query,
  registerEnumType,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GraphQLJSONObject, SafeIntResolver } from 'graphql-scalars';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import type { FileUpload } from '../../../base';
import { CloudThrottlerGuard } from '../../../base';
import type {
  ContainerFileKind,
  ContainerFileStatus,
  ContainerStatus,
} from '../../../models';
import { CurrentUser } from '../../auth';
import type { CurrentUser as CurrentUserType } from '../../auth';
import { WorkspaceType } from '../types';
import { ContainerService } from './service';

enum WorkspaceContainerStatus {
  active = 'active',
  trashed = 'trashed',
}

enum WorkspaceContainerFileKind {
  image = 'image',
  text = 'text',
  pdf = 'pdf',
  directory = 'directory',
}

enum WorkspaceContainerFileStatus {
  pending = 'pending',
  active = 'active',
  deleted = 'deleted',
}

enum ContainerUploadMethod {
  GRAPHQL = 'GRAPHQL',
  PRESIGNED = 'PRESIGNED',
  MULTIPART = 'MULTIPART',
}

registerEnumType(WorkspaceContainerStatus, {
  name: 'WorkspaceContainerStatus',
});
registerEnumType(WorkspaceContainerFileKind, {
  name: 'WorkspaceContainerFileKind',
});
registerEnumType(WorkspaceContainerFileStatus, {
  name: 'WorkspaceContainerFileStatus',
});
registerEnumType(ContainerUploadMethod, {
  name: 'ContainerUploadMethod',
});

@ObjectType()
export class WorkspaceContainerObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field()
  name!: string;

  @Field(() => WorkspaceContainerStatus)
  status!: ContainerStatus;

  @Field(() => String, { nullable: true })
  lastParentFolderNodeId?: string | null;

  @Field(() => String, { nullable: true })
  lastIndex?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;
}

@ObjectType()
export class WorkspaceContainerFileObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  containerId!: string;

  @Field()
  blobKey!: string;

  @Field()
  name!: string;

  @Field(() => WorkspaceContainerFileKind)
  kind!: ContainerFileKind;

  @Field()
  mime!: string;

  @Field(() => SafeIntResolver)
  size!: number;

  @Field(() => Int)
  revision!: number;

  @Field(() => WorkspaceContainerFileStatus)
  status!: ContainerFileStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;
}

@ObjectType()
class ContainerUploadedPart {
  @Field(() => Int)
  partNumber!: number;

  @Field()
  etag!: string;
}

@InputType()
class ContainerUploadedPartInput {
  @Field(() => Int)
  partNumber!: number;

  @Field()
  etag!: string;
}

@ObjectType()
class ContainerFileUploadInitObject {
  @Field(() => ContainerUploadMethod)
  method!: ContainerUploadMethod;

  @Field(() => WorkspaceContainerFileObject)
  file!: WorkspaceContainerFileObject;

  @Field()
  blobKey!: string;

  @Field(() => Boolean, { nullable: true })
  alreadyUploaded?: boolean;

  @Field(() => String, { nullable: true })
  uploadUrl?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  headers?: Record<string, string>;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date;

  @Field(() => String, { nullable: true })
  uploadId?: string;

  @Field(() => Int, { nullable: true })
  partSize?: number;

  @Field(() => [ContainerUploadedPart], { nullable: true })
  uploadedParts?: ContainerUploadedPart[];
}

@ObjectType()
class ContainerFileUploadPartObject {
  @Field()
  uploadUrl!: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  headers?: Record<string, string>;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date;
}

@UseGuards(CloudThrottlerGuard)
@Resolver(() => WorkspaceType)
export class WorkspaceContainerResolver {
  constructor(private readonly containerService: ContainerService) {}

  @ResolveField(() => [WorkspaceContainerObject], {
    description: 'List workspace containers',
  })
  async containers(
    @CurrentUser() user: CurrentUserType,
    @Parent() workspace: WorkspaceType,
    @Args('status', {
      type: () => WorkspaceContainerStatus,
      nullable: true,
    })
    status?: WorkspaceContainerStatus
  ) {
    return this.containerService.listContainers(
      user,
      workspace.id,
      (status ?? 'active') as ContainerStatus
    );
  }

  @Query(() => WorkspaceContainerObject)
  async container(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string
  ) {
    return this.containerService.getContainer(user, id);
  }

  @Query(() => [WorkspaceContainerFileObject])
  async containerFiles(
    @CurrentUser() user: CurrentUserType,
    @Args('containerId') containerId: string
  ) {
    return this.containerService.listFiles(user, containerId);
  }

  @Mutation(() => WorkspaceContainerObject)
  async createContainer(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string,
    @Args('name') name: string,
    @Args('parentFolderNodeId', { nullable: true })
    parentFolderNodeId?: string,
    @Args('index', { nullable: true }) index?: string
  ) {
    return this.containerService.createContainer(user, {
      workspaceId,
      name,
      parentFolderNodeId,
      index,
    });
  }

  @Mutation(() => WorkspaceContainerObject)
  async renameContainer(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string,
    @Args('name') name: string
  ) {
    return this.containerService.renameContainer(user, id, name);
  }

  @Mutation(() => WorkspaceContainerObject)
  async trashContainer(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string,
    @Args('lastParentFolderNodeId', { nullable: true })
    lastParentFolderNodeId?: string,
    @Args('lastIndex', { nullable: true }) lastIndex?: string
  ) {
    return this.containerService.trashContainer(user, id, {
      lastParentFolderNodeId,
      lastIndex,
    });
  }

  @Mutation(() => WorkspaceContainerObject)
  async restoreContainer(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string
  ) {
    return this.containerService.restoreContainer(user, id);
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async createContainerTextFile(
    @CurrentUser() user: CurrentUserType,
    @Args('containerId') containerId: string,
    @Args('name') name: string,
    @Args('content', { nullable: true }) content?: string
  ) {
    return this.containerService.createTextFile(user, {
      containerId,
      name,
      content,
    });
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async createContainerDirectory(
    @CurrentUser() user: CurrentUserType,
    @Args('containerId') containerId: string,
    @Args('name') name: string
  ) {
    return this.containerService.createDirectory(user, {
      containerId,
      name,
    });
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async uploadContainerFile(
    @CurrentUser() user: CurrentUserType,
    @Args('containerId') containerId: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload
  ) {
    return this.containerService.uploadContainerFile(user, containerId, file);
  }

  @Mutation(() => ContainerFileUploadInitObject)
  async initContainerFileUpload(
    @CurrentUser() user: CurrentUserType,
    @Args('containerId') containerId: string,
    @Args('name') name: string,
    @Args('size', { type: () => Int }) size: number,
    @Args('mime') mime: string
  ) {
    return this.containerService.initUpload(user, {
      containerId,
      name,
      size,
      mime,
    });
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async completeContainerFileUpload(
    @CurrentUser() user: CurrentUserType,
    @Args('fileId') fileId: string,
    @Args('uploadId', { nullable: true }) uploadId?: string,
    @Args('parts', {
      type: () => [ContainerUploadedPartInput],
      nullable: true,
    })
    parts?: ContainerUploadedPartInput[]
  ) {
    return this.containerService.completeUpload(user, {
      fileId,
      uploadId,
      parts,
    });
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async uploadInitializedContainerFile(
    @CurrentUser() user: CurrentUserType,
    @Args('fileId') fileId: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload
  ) {
    return this.containerService.uploadInitializedFile(user, fileId, file);
  }

  @Mutation(() => ContainerFileUploadPartObject)
  async containerFileUploadPartUrl(
    @CurrentUser() user: CurrentUserType,
    @Args('fileId') fileId: string,
    @Args('uploadId') uploadId: string,
    @Args('partNumber', { type: () => Int }) partNumber: number
  ) {
    return this.containerService.getUploadPart(user, {
      fileId,
      uploadId,
      partNumber,
    });
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async renameContainerFile(
    @CurrentUser() user: CurrentUserType,
    @Args('fileId') fileId: string,
    @Args('name') name: string
  ) {
    return this.containerService.renameFile(user, fileId, name);
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async deleteContainerFile(
    @CurrentUser() user: CurrentUserType,
    @Args('fileId') fileId: string
  ) {
    return this.containerService.deleteFile(user, fileId);
  }

  @Mutation(() => WorkspaceContainerFileObject)
  async updateContainerTextFile(
    @CurrentUser() user: CurrentUserType,
    @Args('fileId') fileId: string,
    @Args('baseRevision', { type: () => Int }) baseRevision: number,
    @Args('content') content: string
  ) {
    return this.containerService.updateTextFile(user, fileId, {
      baseRevision,
      content,
    });
  }
}
