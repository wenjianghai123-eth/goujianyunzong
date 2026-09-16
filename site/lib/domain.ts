export const STATUSES = ['UNRECORDED', 'PROCESSING', 'ONSITE', 'COMPLETED'] as const;
export type ComponentStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ComponentStatus, string> = {
  UNRECORDED: '未录入',
  PROCESSING: '加工中',
  ONSITE: '现场施工',
  COMPLETED: '安装完成',
};

export const NEXT_STATUS: Record<ComponentStatus, ComponentStatus | null> = {
  UNRECORDED: 'PROCESSING',
  PROCESSING: 'ONSITE',
  ONSITE: 'COMPLETED',
  COMPLETED: null,
};

export type Project = {
  id: string;
  code: string;
  name: string;
  address: string;
  owner: string;
  status: string;
  requireOnsitePhoto: boolean;
  requireCompletePhoto: boolean;
  createdAt: string;
  updatedAt: string;
  currentUserRole: 'PROJECT_ADMIN' | 'FACTORY_OPERATOR' | 'SITE_OPERATOR' | 'VIEWER' | 'AUDITOR';
};

export type ComponentItem = {
  id: string;
  projectId: string;
  code: string;
  name: string;
  type: string;
  specification: string;
  material: string;
  batch: string;
  building: string;
  floor: string;
  area: string;
  entryGroupId: string | null;
  sequenceNo: number | null;
  currentStatus: ComponentStatus;
  version: number;
  qrToken: string;
  modelFileName: string | null;
  modelSize: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type EntryGroup = {
  id: string;
  projectId: string;
  projectName?: string;
  typeCode: string;
  typeName: string;
  locationCode: string;
  locationName: string;
  building: string;
  floor: string;
  area: string;
  specification: string;
  material: string;
  serialWidth: number;
  qrToken: string;
  status: 'ACTIVE' | 'DISABLED';
  componentCount: number;
  onsiteCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type ArrivalBatch = {
  id: string;
  projectId: string;
  entryGroupId: string;
  batchCode: string;
  serialExpression: string;
  actualAt: string;
  vehicleNo: string;
  receiver: string;
  remark: string;
  componentCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  operatorName: string;
  createdAt: string;
  typeCode?: string;
  typeName?: string;
  locationCode?: string;
  locationName?: string;
};

export type ProgressRecord = {
  id: string;
  componentId: string;
  fromStatus: ComponentStatus;
  toStatus: ComponentStatus;
  actualAt: string;
  submittedAt: string;
  operatorName: string;
  remark: string;
  eventType: string;
};

export type PhotoItem = {
  id: string;
  componentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploaderName: string;
  createdAt: string;
  url: string;
};

export type ComponentDetail = ComponentItem & {
  projectName: string;
  progress: ProgressRecord[];
  photos: PhotoItem[];
};
