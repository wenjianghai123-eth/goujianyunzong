import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const authUsers = sqliteTable(
  'auth_users',
  {
    id: text('id').primaryKey(),
    wechatOpenid: text('wechat_openid').notNull(),
    wechatUnionid: text('wechat_unionid'),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url').notNull().default(''),
    createdAt: text('created_at').notNull(),
    lastLoginAt: text('last_login_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_auth_users_wechat_openid').on(table.wechatOpenid),
    uniqueIndex('uq_auth_users_wechat_unionid').on(table.wechatUnionid),
  ],
);

export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [
    index('idx_auth_sessions_user').on(table.userId),
    index('idx_auth_sessions_expires').on(table.expiresAt),
  ],
);

export const oauthStates = sqliteTable(
  'oauth_states',
  {
    id: text('id').primaryKey(),
    returnTo: text('return_to').notNull().default('/'),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [index('idx_oauth_states_expires').on(table.expiresAt)],
);

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    address: text('address').notNull().default(''),
    owner: text('owner').notNull().default(''),
    status: text('status').notNull().default('ACTIVE'),
    requireOnsitePhoto: integer('require_onsite_photo', { mode: 'boolean' })
      .notNull()
      .default(true),
    requireCompletePhoto: integer('require_complete_photo', { mode: 'boolean' })
      .notNull()
      .default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('uq_projects_code').on(table.code)],
);

export const projectMembers = sqliteTable(
  'project_members',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull().default('VIEWER'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_project_members_project_user').on(
      table.projectId,
      table.userId,
    ),
    index('idx_project_members_user').on(table.userId),
  ],
);

export const componentEntryGroups = sqliteTable(
  'component_entry_groups',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    typeCode: text('type_code').notNull(),
    typeName: text('type_name').notNull(),
    locationCode: text('location_code').notNull(),
    locationName: text('location_name').notNull(),
    building: text('building').notNull().default(''),
    floor: text('floor').notNull().default(''),
    area: text('area').notNull().default(''),
    specification: text('specification').notNull().default(''),
    material: text('material').notNull().default(''),
    serialWidth: integer('serial_width').notNull().default(3),
    qrToken: text('qr_token').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    createdBy: text('created_by').notNull(),
  },
  (table) => [
    uniqueIndex('uq_entry_groups_project_type_location').on(
      table.projectId,
      table.typeCode,
      table.locationCode,
    ),
    uniqueIndex('uq_entry_groups_qr_token').on(table.qrToken),
    index('idx_entry_groups_project_status').on(table.projectId, table.status),
  ],
);

export const components = sqliteTable(
  'components',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    specification: text('specification').notNull().default(''),
    material: text('material').notNull().default(''),
    batch: text('batch').notNull().default(''),
    building: text('building').notNull().default(''),
    floor: text('floor').notNull().default(''),
    area: text('area').notNull().default(''),
    entryGroupId: text('entry_group_id').references(
      () => componentEntryGroups.id,
    ),
    sequenceNo: integer('sequence_no'),
    currentStatus: text('current_status').notNull().default('UNRECORDED'),
    version: integer('version').notNull().default(1),
    qrToken: text('qr_token').notNull(),
    modelObjectKey: text('model_object_key'),
    modelFileName: text('model_file_name'),
    modelSize: integer('model_size'),
    notes: text('notes').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    updatedBy: text('updated_by').notNull().default(''),
    disabledAt: text('disabled_at'),
  },
  (table) => [
    uniqueIndex('uq_components_project_code').on(table.projectId, table.code),
    uniqueIndex('uq_components_qr_token').on(table.qrToken),
    uniqueIndex('uq_components_entry_group_sequence').on(
      table.entryGroupId,
      table.sequenceNo,
    ),
    index('idx_components_project_status').on(
      table.projectId,
      table.currentStatus,
    ),
    index('idx_components_project_updated').on(
      table.projectId,
      table.updatedAt,
    ),
  ],
);

export const arrivalBatches = sqliteTable(
  'arrival_batches',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    entryGroupId: text('entry_group_id')
      .notNull()
      .references(() => componentEntryGroups.id),
    batchCode: text('batch_code').notNull(),
    serialExpression: text('serial_expression').notNull(),
    actualAt: text('actual_at').notNull(),
    vehicleNo: text('vehicle_no').notNull().default(''),
    receiver: text('receiver').notNull().default(''),
    remark: text('remark').notNull().default(''),
    componentCount: integer('component_count').notNull(),
    createdCount: integer('created_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    operatorId: text('operator_id').notNull(),
    operatorName: text('operator_name').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_arrival_batches_group_idempotency').on(
      table.entryGroupId,
      table.idempotencyKey,
    ),
    index('idx_arrival_batches_project_time').on(
      table.projectId,
      table.createdAt,
    ),
    index('idx_arrival_batches_group_time').on(
      table.entryGroupId,
      table.createdAt,
    ),
  ],
);

export const arrivalBatchItems = sqliteTable(
  'arrival_batch_items',
  {
    id: text('id').primaryKey(),
    arrivalBatchId: text('arrival_batch_id')
      .notNull()
      .references(() => arrivalBatches.id),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    sequenceNo: integer('sequence_no').notNull(),
    result: text('result').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_arrival_batch_items_batch_component').on(
      table.arrivalBatchId,
      table.componentId,
    ),
    index('idx_arrival_batch_items_component').on(table.componentId),
  ],
);

export const progressRecords = sqliteTable(
  'progress_records',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    actualAt: text('actual_at').notNull(),
    submittedAt: text('submitted_at').notNull(),
    operatorId: text('operator_id').notNull(),
    operatorName: text('operator_name').notNull(),
    operatorEmail: text('operator_email').notNull(),
    remark: text('remark').notNull().default(''),
    idempotencyKey: text('idempotency_key').notNull(),
    eventType: text('event_type').notNull().default('PROGRESS'),
  },
  (table) => [
    uniqueIndex('uq_progress_component_idempotency').on(
      table.componentId,
      table.idempotencyKey,
    ),
    index('idx_progress_component_time').on(
      table.componentId,
      table.submittedAt,
    ),
  ],
);

export const milestones = sqliteTable(
  'milestones',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    type: text('type').notNull(),
    actualAt: text('actual_at').notNull(),
    operatorId: text('operator_id').notNull(),
    operatorName: text('operator_name').notNull(),
    vehicleNo: text('vehicle_no').notNull().default(''),
    receiver: text('receiver').notNull().default(''),
    location: text('location').notNull().default(''),
    remark: text('remark').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_milestones_component_time').on(
      table.componentId,
      table.actualAt,
    ),
  ],
);

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    progressRecordId: text('progress_record_id').references(
      () => progressRecords.id,
    ),
    milestoneId: text('milestone_id').references(() => milestones.id),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    uploaderId: text('uploader_id').notNull(),
    uploaderName: text('uploader_name').notNull(),
    shotAt: text('shot_at'),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('idx_photos_component_time').on(table.componentId, table.createdAt),
  ],
);

export const modelAssets = sqliteTable(
  'model_assets',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    version: integer('version').notNull(),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    size: integer('size').notNull(),
    uploaderId: text('uploader_id').notNull(),
    uploaderName: text('uploader_name').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('uq_model_assets_component_version').on(
      table.componentId,
      table.version,
    ),
    index('idx_model_assets_component_time').on(
      table.componentId,
      table.createdAt,
    ),
  ],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull(),
    actorName: text('actor_name').notNull(),
    projectId: text('project_id'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    ip: text('ip').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_audit_project_time').on(table.projectId, table.createdAt),
  ],
);
