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

import { CloudThrottlerGuard } from '../../../base';
import type {
  KnowledgeBaseSourceOverride,
  KnowledgeBaseSourceStatus,
  KnowledgeBaseSourceType,
  KnowledgeBaseStatus,
} from '../../../models';
import { CurrentUser } from '../../auth';
import type { CurrentUser as CurrentUserType } from '../../auth';
import { WorkspaceType } from '../types';
import { KnowledgeBaseService } from './service';

enum WorkspaceKnowledgeBaseStatus {
  active = 'active',
  trashed = 'trashed',
}

enum WorkspaceKnowledgeBaseSourceType {
  doc = 'doc',
  container = 'container',
  containerFile = 'containerFile',
  blob = 'blob',
}

enum WorkspaceKnowledgeBaseSourceStatus {
  pending = 'pending',
  indexed = 'indexed',
  stale = 'stale',
  failed = 'failed',
}

enum WorkspaceKnowledgeBaseSourceOverride {
  include = 'include',
  exclude = 'exclude',
}

registerEnumType(WorkspaceKnowledgeBaseStatus, {
  name: 'WorkspaceKnowledgeBaseStatus',
});
registerEnumType(WorkspaceKnowledgeBaseSourceType, {
  name: 'WorkspaceKnowledgeBaseSourceType',
});
registerEnumType(WorkspaceKnowledgeBaseSourceStatus, {
  name: 'WorkspaceKnowledgeBaseSourceStatus',
});
registerEnumType(WorkspaceKnowledgeBaseSourceOverride, {
  name: 'WorkspaceKnowledgeBaseSourceOverride',
});

@ObjectType()
export class WorkspaceKnowledgeBaseObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field()
  folderNodeId!: string;

  @Field()
  name!: string;

  @Field()
  includeSubfolders!: boolean;

  @Field(() => Int)
  selectionCreateDocMinLines!: number;

  @Field(() => WorkspaceKnowledgeBaseStatus)
  status!: KnowledgeBaseStatus;

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
export class WorkspaceKnowledgeBaseSourceObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field(() => ID)
  knowledgeBaseId!: string;

  @Field(() => WorkspaceKnowledgeBaseSourceType)
  sourceType!: KnowledgeBaseSourceType;

  @Field()
  sourceId!: string;

  @Field(() => String, { nullable: true })
  parentFolderNodeId?: string | null;

  @Field()
  included!: boolean;

  @Field(() => WorkspaceKnowledgeBaseSourceOverride, { nullable: true })
  manualOverride?: KnowledgeBaseSourceOverride | null;

  @Field(() => WorkspaceKnowledgeBaseSourceStatus)
  status!: KnowledgeBaseSourceStatus;

  @Field(() => String, { nullable: true })
  contentHash?: string | null;

  @Field(() => Date, { nullable: true })
  indexedAt?: Date | null;

  @Field(() => String, { nullable: true })
  error?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
class KnowledgeBaseAskResult {
  @Field()
  answer!: string;

  @Field(() => [WorkspaceKnowledgeBaseSourceObject])
  sources!: WorkspaceKnowledgeBaseSourceObject[];
}

@ObjectType()
class KnowledgeBaseSelectionDocDraft {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  workspaceId!: string;

  @Field()
  folderNodeId!: string;

  @Field()
  title!: string;

  @Field()
  content!: string;
}

@InputType()
class KnowledgeBaseSourceInput {
  @Field(() => WorkspaceKnowledgeBaseSourceType)
  sourceType!: KnowledgeBaseSourceType;

  @Field()
  sourceId!: string;

  @Field(() => String, { nullable: true })
  parentFolderNodeId?: string | null;

  @Field(() => String, { nullable: true })
  contentHash?: string | null;
}

@InputType()
class KnowledgeBaseSourceOverrideInput {
  @Field(() => WorkspaceKnowledgeBaseSourceType)
  sourceType!: KnowledgeBaseSourceType;

  @Field()
  sourceId!: string;

  @Field(() => WorkspaceKnowledgeBaseSourceOverride, { nullable: true })
  manualOverride?: KnowledgeBaseSourceOverride | null;
}

@UseGuards(CloudThrottlerGuard)
@Resolver(() => WorkspaceType)
export class WorkspaceKnowledgeBaseResolver {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @ResolveField(() => [WorkspaceKnowledgeBaseObject], {
    description: 'List workspace Knowledge Bases',
  })
  async knowledgeBases(
    @CurrentUser() user: CurrentUserType,
    @Parent() workspace: WorkspaceType,
    @Args('status', {
      type: () => WorkspaceKnowledgeBaseStatus,
      nullable: true,
    })
    status?: WorkspaceKnowledgeBaseStatus
  ) {
    return this.knowledgeBaseService.listKnowledgeBases(
      user,
      workspace.id,
      (status ?? 'active') as KnowledgeBaseStatus
    );
  }

  @Query(() => WorkspaceKnowledgeBaseObject)
  async knowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string
  ) {
    return this.knowledgeBaseService.getKnowledgeBase(user, id);
  }

  @Query(() => [WorkspaceKnowledgeBaseSourceObject])
  async knowledgeBaseSources(
    @CurrentUser() user: CurrentUserType,
    @Args('knowledgeBaseId') knowledgeBaseId: string
  ) {
    return this.knowledgeBaseService.listKnowledgeBaseSources(
      user,
      knowledgeBaseId
    );
  }

  @Mutation(() => WorkspaceKnowledgeBaseObject)
  async createKnowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string,
    @Args('folderNodeId') folderNodeId: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('index', { nullable: true }) index?: string
  ) {
    return this.knowledgeBaseService.createKnowledgeBase(user, {
      workspaceId,
      folderNodeId,
      name,
      index,
    });
  }

  @Mutation(() => WorkspaceKnowledgeBaseObject)
  async renameKnowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string,
    @Args('name') name: string
  ) {
    return this.knowledgeBaseService.renameKnowledgeBase(user, id, name);
  }

  @Mutation(() => WorkspaceKnowledgeBaseObject)
  async trashKnowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string,
    @Args('lastParentFolderNodeId', { nullable: true })
    lastParentFolderNodeId?: string,
    @Args('lastIndex', { nullable: true }) lastIndex?: string
  ) {
    return this.knowledgeBaseService.trashKnowledgeBase(user, id, {
      lastParentFolderNodeId,
      lastIndex,
    });
  }

  @Mutation(() => WorkspaceKnowledgeBaseObject)
  async restoreKnowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string
  ) {
    return this.knowledgeBaseService.restoreKnowledgeBase(user, id);
  }

  @Mutation(() => WorkspaceKnowledgeBaseObject)
  async updateKnowledgeBaseSettings(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string,
    @Args('includeSubfolders', { nullable: true }) includeSubfolders?: boolean,
    @Args('selectionCreateDocMinLines', {
      type: () => Int,
      nullable: true,
    })
    selectionCreateDocMinLines?: number
  ) {
    return this.knowledgeBaseService.updateKnowledgeBaseSettings(user, id, {
      includeSubfolders,
      selectionCreateDocMinLines,
    });
  }

  @Mutation(() => WorkspaceKnowledgeBaseObject)
  async moveKnowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('id') id: string,
    @Args('folderNodeId') folderNodeId: string,
    @Args('index', { nullable: true }) index?: string
  ) {
    return this.knowledgeBaseService.moveKnowledgeBase(user, id, {
      folderNodeId,
      index,
    });
  }

  @Mutation(() => [WorkspaceKnowledgeBaseSourceObject])
  async syncKnowledgeBaseSources(
    @CurrentUser() user: CurrentUserType,
    @Args('knowledgeBaseId') knowledgeBaseId: string,
    @Args('sources', { type: () => [KnowledgeBaseSourceInput] })
    sources: KnowledgeBaseSourceInput[]
  ) {
    return this.knowledgeBaseService.syncKnowledgeBaseSources(
      user,
      knowledgeBaseId,
      sources
    );
  }

  @Mutation(() => [WorkspaceKnowledgeBaseSourceObject])
  async updateKnowledgeBaseSourceOverrides(
    @CurrentUser() user: CurrentUserType,
    @Args('knowledgeBaseId') knowledgeBaseId: string,
    @Args('overrides', {
      type: () => [KnowledgeBaseSourceOverrideInput],
    })
    overrides: KnowledgeBaseSourceOverrideInput[]
  ) {
    return this.knowledgeBaseService.updateKnowledgeBaseSourceOverrides(
      user,
      knowledgeBaseId,
      overrides
    );
  }

  @Mutation(() => [WorkspaceKnowledgeBaseSourceObject])
  async reindexKnowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('knowledgeBaseId') knowledgeBaseId: string
  ) {
    return this.knowledgeBaseService.reindexKnowledgeBase(user, knowledgeBaseId);
  }

  @Mutation(() => KnowledgeBaseAskResult)
  async askKnowledgeBase(
    @CurrentUser() user: CurrentUserType,
    @Args('knowledgeBaseId') knowledgeBaseId: string,
    @Args('question') question: string
  ) {
    return this.knowledgeBaseService.askKnowledgeBase(
      user,
      knowledgeBaseId,
      question
    );
  }

  @Mutation(() => KnowledgeBaseSelectionDocDraft)
  async createDocFromKnowledgeBaseSelection(
    @CurrentUser() user: CurrentUserType,
    @Args('knowledgeBaseId') knowledgeBaseId: string,
    @Args('selection') selection: string
  ) {
    return this.knowledgeBaseService.createDocFromKnowledgeBaseSelection(
      user,
      knowledgeBaseId,
      selection
    );
  }
}
