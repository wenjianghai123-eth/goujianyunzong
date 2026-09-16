'use client';
/* oxlint-disable next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Boxes,
  Building2,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Download,
  Factory,
  FileClock,
  FileUp,
  HardHat,
  ImageIcon,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';
import { ModelViewer } from './model-viewer';
import { createIdempotencyKey } from '@/lib/client-id';
import {
  NEXT_STATUS,
  STATUS_LABELS,
  type ComponentDetail,
  type ComponentItem,
  type ComponentStatus,
  type Project,
} from '@/lib/domain';

type ViewKey =
  | 'dashboard'
  | 'components'
  | 'qr'
  | 'models'
  | 'records'
  | 'members'
  | 'settings';
type FormSubmitEvent = {
  preventDefault(): void;
  currentTarget: HTMLFormElement;
};
type Summary = {
  total: number;
  unrecorded: number;
  processing: number;
  onsite: number;
  completed: number;
};
type ActivityItem = {
  id: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  fromStatus: ComponentStatus;
  toStatus: ComponentStatus;
  operatorName: string;
  submittedAt: string;
  remark: string;
};
type ProjectMember = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: Project['currentUserRole'];
  createdAt: string;
};

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        message: string;
        details?: Array<{ row: number; message: string }>;
      };
    };

const navigation: Array<{
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: 'dashboard', label: '项目总览', icon: LayoutDashboard },
  { key: 'components', label: '构件管理', icon: Boxes },
  { key: 'qr', label: '二维码中心', icon: QrCode },
  { key: 'models', label: '三维模型', icon: Box },
  { key: 'records', label: '进度记录', icon: FileClock },
];

const roleLabels: Record<Project['currentUserRole'], string> = {
  PROJECT_ADMIN: '项目管理员',
  FACTORY_OPERATOR: '工厂录入员',
  SITE_OPERATOR: '现场录入员',
  VIEWER: '查看者',
  AUDITOR: '审计员',
};

const statusClass: Record<ComponentStatus, string> = {
  UNRECORDED: 'status-unrecorded',
  PROCESSING: 'status-processing',
  ONSITE: 'status-onsite',
  COMPLETED: 'status-complete',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok)
    throw new Error(payload.ok ? '请求失败' : payload.error.message);
  return payload.data;
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function Workspace({
  displayName,
  userId,
  provider,
}: {
  displayName: string;
  userId: string;
  provider: 'WECHAT' | 'CHATGPT';
}) {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    unrecorded: 0,
    processing: 0,
    onsite: 0,
    completed: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComponentStatus | 'ALL'>(
    'ALL',
  );
  const [projectDialog, setProjectDialog] = useState(false);
  const [componentDialog, setComponentDialog] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [qrComponent, setQrComponent] = useState<ComponentItem | null>(null);
  const [progressComponent, setProgressComponent] =
    useState<ComponentItem | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const activeProject =
    projects.find((project) => project.id === projectId) ?? null;

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<Project[]>('/api/projects');
      setProjects(data);
      setProjectId((current) =>
        current && data.some((item) => item.id === current)
          ? current
          : (data[0]?.id ?? ''),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '项目加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjectData = useCallback(async () => {
    if (!projectId) {
      setComponents([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [componentData, dashboard] = await Promise.all([
        api<ComponentItem[]>(
          `/api/components?projectId=${encodeURIComponent(projectId)}&limit=500`,
        ),
        api<{ summary: Summary; recent: ActivityItem[] }>(
          `/api/dashboard?projectId=${encodeURIComponent(projectId)}`,
        ),
      ]);
      setComponents(componentData);
      setSummary({
        total: Number(dashboard.summary.total || 0),
        unrecorded: Number(dashboard.summary.unrecorded || 0),
        processing: Number(dashboard.summary.processing || 0),
        onsite: Number(dashboard.summary.onsite || 0),
        completed: Number(dashboard.summary.completed || 0),
      });
      setActivities(dashboard.recent);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : '项目数据加载失败',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => void loadProjects());
  }, [loadProjects]);
  useEffect(() => {
    queueMicrotask(() => void loadProjectData());
  }, [loadProjectData]);

  useEffect(() => {
    const context =
      typeof document === 'undefined'
        ? undefined
        : (
            document as Document & {
              modelContext?: {
                registerTool: (
                  tool: unknown,
                  options?: { signal?: AbortSignal },
                ) => void | Promise<void>;
              };
            }
          ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'list_project_components',
          title: '查询项目构件',
          description: '按构件编码、名称或状态查询当前项目的构件台账。',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              status: {
                type: 'string',
                enum: ['UNRECORDED', 'PROCESSING', 'ONSITE', 'COMPLETED'],
              },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const values =
              input && typeof input === 'object'
                ? (input as { query?: string; status?: ComponentStatus })
                : {};
            const params = new URLSearchParams({ projectId });
            if (values.query) params.set('query', values.query);
            if (values.status) params.set('status', values.status);
            const rows = await api<ComponentItem[]>(
              `/api/components?${params}`,
            );
            return {
              count: rows.length,
              components: rows.map(
                ({ id, code, name, currentStatus, building, floor, area }) => ({
                  id,
                  code,
                  name,
                  status: currentStatus,
                  location: [building, floor, area].filter(Boolean).join(' / '),
                }),
              ),
            };
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'advance_component_progress',
          title: '推进构件进度',
          description:
            '将指定构件推进到状态机允许的下一进度；现场施工和安装完成可能需要先在界面上传照片。',
          inputSchema: {
            type: 'object',
            properties: {
              componentId: { type: 'string' },
              remark: { type: 'string' },
            },
            required: ['componentId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const values = input as { componentId?: string; remark?: string };
            const component = components.find(
              (item) => item.id === values.componentId,
            );
            if (!component) throw new Error('当前项目中未找到该构件');
            const next = NEXT_STATUS[component.currentStatus];
            if (!next) throw new Error('该构件已经安装完成');
            if (next === 'ONSITE' || next === 'COMPLETED')
              throw new Error('该进度需要现场照片，请在构件详情中完成提交');
            const result = await api<{
              currentStatus: ComponentStatus;
              version: number;
            }>(`/api/components/${component.id}/progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toStatus: next,
                actualAt: new Date().toISOString(),
                remark: values.remark ?? '',
                photoIds: [],
                componentVersion: component.version,
                idempotencyKey: createIdempotencyKey(),
              }),
            });
            await loadProjectData();
            return {
              componentId: component.id,
              status: result.currentStatus,
              version: result.version,
            };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [components, loadProjectData, projectId]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return components.filter((component) => {
      if (statusFilter !== 'ALL' && component.currentStatus !== statusFilter)
        return false;
      return (
        !text ||
        [
          component.code,
          component.name,
          component.batch,
          component.building,
          component.floor,
          component.area,
        ].some((value) => value.toLowerCase().includes(text))
      );
    });
  }, [components, query, statusFilter]);

  const createProject = async (event: FormSubmitEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const project = await api<Project>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setProjects((current) => [project, ...current]);
      setProjectId(project.id);
      setProjectDialog(false);
      toast.add({
        title: '项目创建成功',
        description: project.name,
        type: 'success',
      });
    } catch (submitError) {
      toast.add({
        title: '创建失败',
        description:
          submitError instanceof Error ? submitError.message : '请稍后重试',
        type: 'error',
      });
    }
  };

  const createComponent = async (event: FormSubmitEvent) => {
    event.preventDefault();
    if (!projectId) return;
    const form = new FormData(event.currentTarget);
    try {
      const component = await api<ComponentItem>('/api/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, ...Object.fromEntries(form) }),
      });
      setComponentDialog(false);
      await loadProjectData();
      toast.add({
        title: '构件已建档',
        description: `${component.code} 的二维码已同步生成`,
        type: 'success',
      });
    } catch (submitError) {
      toast.add({
        title: '新增失败',
        description:
          submitError instanceof Error ? submitError.message : '请稍后重试',
        type: 'error',
      });
    }
  };

  const handleImport = async (file?: File) => {
    if (!file || !projectId) return;
    try {
      const rows = parseCsv(await file.text());
      const result = await api<{ imported: number }>('/api/components/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, rows }),
      });
      await loadProjectData();
      toast.add({
        title: '导入完成',
        description: `已新增 ${result.imported} 个构件`,
        type: 'success',
      });
    } catch (importError) {
      toast.add({
        title: '导入失败',
        description:
          importError instanceof Error ? importError.message : '请检查文件格式',
        type: 'error',
      });
    }
    if (importRef.current) importRef.current.value = '';
  };

  if (loading && !projects.length) {
    return (
      <div className="full-loader">
        <BrandMark />
        <LoaderCircle className="animate-spin" />
        <p>正在载入项目数据…</p>
      </div>
    );
  }

  return (
    <Toaster>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="border-r-0">
          <SidebarHeader className="px-4 pb-4 pt-5">
            <div className="flex items-center gap-3 overflow-hidden">
              <BrandMark />
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-[15px] font-bold tracking-wide text-white">
                  构件云踪
                </p>
                <p className="truncate text-xs text-slate-400">
                  工程智造协同平台
                </p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>工程管理</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={view === item.key}
                        tooltip={item.label}
                        className="sidebar-nav-item"
                        onClick={() => setView(item.key)}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>系统协作</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={view === 'members'}
                      tooltip="项目成员"
                      className="sidebar-nav-item"
                      onClick={() => setView('members')}
                    >
                      <Users />
                      <span>项目成员</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={view === 'settings'}
                      tooltip="项目设置"
                      className="sidebar-nav-item"
                      onClick={() => setView('settings')}
                    >
                      <Settings2 />
                      <span>项目设置</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="sidebar-user" title={`账号 ID：${userId}`}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-400 text-xs font-bold text-slate-950">
                {displayName.slice(0, 1)}
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium text-slate-100">
                  {displayName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {provider === 'WECHAT' ? '微信 · ' : ''}
                  {activeProject
                    ? roleLabels[activeProject.currentUserRole]
                    : '项目成员'}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0 bg-[var(--work-canvas)]">
          <header className="app-header">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="text-slate-600" />
              <div className="header-divider" />
              {projects.length ? (
                <Select
                  value={projectId}
                  onValueChange={(value) => setProjectId(String(value))}
                >
                  <SelectTrigger className="project-switcher">
                    <Building2 className="size-4 text-blue-700" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm font-semibold">尚未创建项目</span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="新建项目"
                onClick={() => setProjectDialog(true)}
              >
                <Plus />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="hidden gap-2 sm:flex"
                disabled={!components.length}
                onClick={() =>
                  components[0] &&
                  window.open(`/q/${components[0].qrToken}`, '_blank')
                }
              >
                <ScanLine />
                模拟扫码
              </Button>
              <Button
                className="primary-action gap-2"
                disabled={!projectId}
                onClick={() => setView('qr')}
              >
                <QrCode />
                <span className="hidden sm:inline">二维码中心</span>
              </Button>
              <a
                className="logout-link"
                href={
                  provider === 'WECHAT'
                    ? '/auth/logout?return_to=%2F'
                    : '/signout-with-chatgpt?return_to=%2F'
                }
              >
                退出
              </a>
            </div>
          </header>

          <div className="page-content">
            {error && (
              <div className="error-banner">
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadProjects()}
                >
                  <RefreshCw />
                  重试
                </Button>
              </div>
            )}
            {!projects.length ? (
              <ProjectOnboarding
                onCreate={() => setProjectDialog(true)}
                userId={userId}
                provider={provider}
              />
            ) : (
              <>
                {view === 'dashboard' && (
                  <DashboardView
                    project={activeProject!}
                    summary={summary}
                    activities={activities}
                    components={components}
                    onOpen={setDetailId}
                    onRefresh={() => void loadProjectData()}
                  />
                )}
                {view === 'components' && (
                  <ComponentsView
                    rows={filtered}
                    query={query}
                    onQuery={setQuery}
                    status={statusFilter}
                    onStatus={setStatusFilter}
                    onCreate={() => setComponentDialog(true)}
                    onImport={() => importRef.current?.click()}
                    onOpen={setDetailId}
                    onQr={setQrComponent}
                    onProgress={setProgressComponent}
                    projectId={projectId}
                  />
                )}
                {view === 'qr' && (
                  <QrView
                    rows={filtered}
                    onQuery={setQuery}
                    onOpenQr={setQrComponent}
                  />
                )}
                {view === 'models' && (
                  <ModelsView rows={filtered} onOpen={setDetailId} />
                )}
                {view === 'records' && (
                  <RecordsView rows={activities} onOpen={setDetailId} />
                )}
                {view === 'members' && (
                  <MembersView
                    projectId={projectId}
                    canManage={
                      activeProject?.currentUserRole === 'PROJECT_ADMIN'
                    }
                  />
                )}
                {view === 'settings' && (
                  <SettingsView
                    key={activeProject!.id}
                    project={activeProject!}
                    canManage={
                      activeProject?.currentUserRole === 'PROJECT_ADMIN'
                    }
                    onSaved={loadProjects}
                  />
                )}
              </>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => void handleImport(event.target.files?.[0])}
      />
      <ProjectDialog
        open={projectDialog}
        onOpenChange={setProjectDialog}
        onSubmit={createProject}
      />
      <ComponentDialog
        open={componentDialog}
        onOpenChange={setComponentDialog}
        onSubmit={createComponent}
      />
      <ComponentSheet
        id={detailId}
        canAdmin={activeProject?.currentUserRole === 'PROJECT_ADMIN'}
        onOpenChange={(open) => !open && setDetailId(null)}
        onUpdated={loadProjectData}
        onProgress={(component) => setProgressComponent(component)}
      />
      <QrDialog
        key={qrComponent?.id ?? 'no-qr'}
        component={qrComponent}
        canReset={activeProject?.currentUserRole === 'PROJECT_ADMIN'}
        onUpdated={loadProjectData}
        onOpenChange={(open) => !open && setQrComponent(null)}
      />
      <ProgressDialog
        component={progressComponent}
        onOpenChange={(open) => !open && setProgressComponent(null)}
        onSaved={async () => {
          setProgressComponent(null);
          await loadProjectData();
          if (detailId) setDetailId(detailId);
        }}
      />
    </Toaster>
  );
}

function ProjectOnboarding({
  onCreate,
  userId,
  provider,
}: {
  onCreate: () => void;
  userId: string;
  provider: 'WECHAT' | 'CHATGPT';
}) {
  const copyId = async () => {
    await navigator.clipboard.writeText(userId);
    toast.add({
      title: '账号 ID 已复制',
      description: '发送给项目管理员即可添加到已有项目',
      type: 'success',
    });
  };
  return (
    <Card className="onboarding-card">
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>创建第一个工程项目</EmptyTitle>
            <EmptyDescription>
              项目是构件台账、二维码和进度统计的管理边界。创建后即可录入或批量导入构件。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex flex-col gap-3">
            <Button className="primary-action" onClick={onCreate}>
              <Plus />
              创建项目
            </Button>
            {provider === 'WECHAT' && (
              <Button variant="outline" onClick={() => void copyId()}>
                <Users />
                复制我的成员 ID
              </Button>
            )}
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  );
}

function DashboardView({
  project,
  summary,
  activities,
  components,
  onOpen,
  onRefresh,
}: {
  project: Project;
  summary: Summary;
  activities: ActivityItem[];
  components: ComponentItem[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
}) {
  const rate = summary.total
    ? Math.round((summary.completed / summary.total) * 1000) / 10
    : 0;
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="signal-dot" />
            数据同步正常 · 实时更新
          </div>
          <h1>项目进度总览</h1>
          <p>
            {project.name}
            {project.address ? ` · ${project.address}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw />
          刷新数据
        </Button>
      </section>
      <section className="metric-grid" aria-label="项目关键指标">
        <MetricCard
          label="构件总数"
          value={summary.total}
          detail={`未录入 ${summary.unrecorded} 件`}
          icon={Boxes}
          tone="navy"
        />
        <MetricCard
          label="加工中"
          value={summary.processing}
          detail={percent(summary.processing, summary.total)}
          icon={Factory}
          tone="blue"
        />
        <MetricCard
          label="现场施工"
          value={summary.onsite}
          detail={percent(summary.onsite, summary.total)}
          icon={HardHat}
          tone="orange"
        />
        <MetricCard
          label="安装完成"
          value={summary.completed}
          detail={`总体完成率 ${rate}%`}
          icon={CheckCircle2}
          tone="green"
        />
      </section>
      <section className="dashboard-grid">
        <Card className="progress-card">
          <CardHeader>
            <CardTitle>整体进度</CardTitle>
            <CardDescription>按有效构件数量统计</CardDescription>
            <CardAction>
              <CircleGauge className="size-5 text-blue-700" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="progress-hero">
              <div>
                <strong>{rate}%</strong>
                <span>已安装完成</span>
              </div>
              <span className="text-xs text-slate-500">
                {summary.completed} / {summary.total} 件
              </span>
            </div>
            <Progress value={rate} className="mt-5">
              <ProgressTrack className="h-2 bg-slate-100">
                <ProgressIndicator className="bg-blue-700" />
              </ProgressTrack>
            </Progress>
            <div className="stage-track">
              <Stage label="未录入" value={summary.unrecorded} color="slate" />
              <Stage label="加工中" value={summary.processing} color="blue" />
              <Stage label="现场施工" value={summary.onsite} color="orange" />
              <Stage label="安装完成" value={summary.completed} color="green" />
            </div>
          </CardContent>
        </Card>
        <Card className="activity-card">
          <CardHeader>
            <CardTitle>现场动态</CardTitle>
            <CardDescription>最近状态流转记录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {activities.length ? (
              activities.slice(0, 4).map((item) => (
                <button
                  className="activity-row w-full text-left"
                  key={item.id}
                  onClick={() => onOpen(item.componentId)}
                >
                  <span
                    className={`activity-icon activity-${item.toStatus === 'COMPLETED' ? 'green' : item.toStatus === 'ONSITE' ? 'orange' : 'blue'}`}
                  >
                    <Clock3 />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">
                      {item.componentCode} · {STATUS_LABELS[item.toStatus]}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.operatorName} · {dateTime(item.submittedAt)}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <SmallEmpty icon={Clock3} title="暂无进度记录" />
            )}
          </CardContent>
        </Card>
      </section>
      <Card className="component-card">
        <CardHeader className="border-b">
          <div>
            <CardTitle>最近更新构件</CardTitle>
            <CardDescription>工厂与现场的最新流转信息</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {components.length ? (
            <ComponentTable rows={components.slice(0, 6)} onOpen={onOpen} />
          ) : (
            <SmallEmpty icon={Boxes} title="暂无构件，请前往构件管理建档" />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ComponentsView({
  rows,
  query,
  onQuery,
  status,
  onStatus,
  onCreate,
  onImport,
  onOpen,
  onQr,
  onProgress,
  projectId,
}: {
  rows: ComponentItem[];
  query: string;
  onQuery: (value: string) => void;
  status: ComponentStatus | 'ALL';
  onStatus: (value: ComponentStatus | 'ALL') => void;
  onCreate: () => void;
  onImport: () => void;
  onOpen: (id: string) => void;
  onQr: (item: ComponentItem) => void;
  onProgress: (item: ComponentItem) => void;
  projectId: string;
}) {
  return (
    <>
      <PageTitle
        title="构件管理"
        description={`共 ${rows.length} 个符合条件的构件`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                window.open('/component-import-template.csv', '_blank')
              }
            >
              <Download />
              下载模板
            </Button>
            <Button variant="outline" onClick={onImport}>
              <FileUp />
              批量导入 CSV
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                window.location.assign(
                  `/api/components/export?projectId=${encodeURIComponent(projectId)}`,
                )
              }
            >
              <Download />
              导出
            </Button>
            <Button className="primary-action" onClick={onCreate}>
              <Plus />
              新增构件
            </Button>
          </>
        }
      />
      <Card className="component-card mt-0">
        <CardHeader className="border-b">
          <div className="toolbar">
            <div className="search-field">
              <Search />
              <Input
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                aria-label="搜索构件"
                placeholder="搜索编号、名称、批次或位置"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) =>
                onStatus(value as ComponentStatus | 'ALL')
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部进度</SelectItem>
                <SelectItem value="UNRECORDED">未录入</SelectItem>
                <SelectItem value="PROCESSING">加工中</SelectItem>
                <SelectItem value="ONSITE">现场施工</SelectItem>
                <SelectItem value="COMPLETED">安装完成</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length ? (
            <ComponentTable
              rows={rows}
              onOpen={onOpen}
              onQr={onQr}
              onProgress={onProgress}
            />
          ) : (
            <SmallEmpty icon={Search} title="没有找到符合条件的构件" />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ComponentTable({
  rows,
  onOpen,
  onQr,
  onProgress,
}: {
  rows: ComponentItem[];
  onOpen: (id: string) => void;
  onQr?: (item: ComponentItem) => void;
  onProgress?: (item: ComponentItem) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-5">构件</TableHead>
          <TableHead>安装位置</TableHead>
          <TableHead>生产批次</TableHead>
          <TableHead>当前进度</TableHead>
          <TableHead>最近更新</TableHead>
          <TableHead className="w-40">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((component) => (
          <TableRow key={component.id}>
            <TableCell className="pl-5">
              <button
                className="flex items-center gap-3 text-left"
                onClick={() => onOpen(component.id)}
              >
                <div className="component-cube">
                  <Box />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {component.code}
                  </p>
                  <p className="text-xs text-slate-500">
                    {component.name} · {component.type}
                  </p>
                </div>
              </button>
            </TableCell>
            <TableCell>{locationText(component)}</TableCell>
            <TableCell className="font-mono text-xs">
              {component.batch || '—'}
            </TableCell>
            <TableCell>
              <StatusBadge status={component.currentStatus} />
            </TableCell>
            <TableCell>
              <p className="text-sm">{dateTime(component.updatedAt)}</p>
              <p className="text-xs text-slate-500">
                {component.updatedBy || '系统建档'}
              </p>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpen(component.id)}
                >
                  详情
                </Button>
                {onQr && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${component.code} 二维码`}
                    onClick={() => onQr(component)}
                  >
                    <QrCode />
                  </Button>
                )}
                {onProgress && NEXT_STATUS[component.currentStatus] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onProgress(component)}
                  >
                    录入
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function QrView({
  rows,
  onQuery,
  onOpenQr,
}: {
  rows: ComponentItem[];
  onQuery: (value: string) => void;
  onOpenQr: (item: ComponentItem) => void;
}) {
  return (
    <>
      <PageTitle
        title="二维码中心"
        description="一构件一码，扫码即可查看与录入进度"
        actions={
          <div className="search-field">
            <Search />
            <Input
              onChange={(event) => onQuery(event.target.value)}
              placeholder="搜索构件"
              aria-label="搜索二维码"
            />
          </div>
        }
      />
      {rows.length ? (
        <div className="qr-grid">
          {rows.map((component) => (
            <Card className="qr-card" key={component.id}>
              <CardContent>
                <button onClick={() => onOpenQr(component)} className="w-full">
                  <img
                    src={`/api/components/${component.id}/qr`}
                    alt={`${component.code} 二维码`}
                  />
                  <div className="mt-3 text-left">
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {component.code}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {component.name} · {locationText(component)}
                    </p>
                    <div className="mt-3">
                      <StatusBadge status={component.currentStatus} />
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <SmallEmpty icon={QrCode} title="暂无可生成二维码的构件" />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ModelsView({
  rows,
  onOpen,
}: {
  rows: ComponentItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <PageTitle
        title="三维模型"
        description="在线查看构件 GLB 模型及版本信息"
      />
      {rows.length ? (
        <div className="model-grid">
          {rows.map((component) => (
            <Card key={component.id} className="model-list-card">
              <div className="model-thumb">
                <Box />
              </div>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono font-bold">{component.code}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {component.name}
                    </p>
                  </div>
                  <StatusBadge status={component.currentStatus} />
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  {component.modelFileName
                    ? `${component.modelFileName} · ${formatBytes(component.modelSize ?? 0)}`
                    : '尚未上传 GLB 模型'}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => onOpen(component.id)}
                >
                  {component.modelFileName ? '查看模型' : '上传模型'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <SmallEmpty icon={Box} title="暂无构件模型" />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function RecordsView({
  rows,
  onOpen,
}: {
  rows: ActivityItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <PageTitle
        title="进度记录"
        description="所有状态变更均追加记录并保留操作人"
      />
      <Card>
        <CardContent className="p-0">
          {rows.length ? (
            <div className="record-list">
              {rows.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpen(item.componentId)}
                  className="record-row"
                >
                  <span
                    className={`activity-icon activity-${item.toStatus === 'COMPLETED' ? 'green' : item.toStatus === 'ONSITE' ? 'orange' : 'blue'}`}
                  >
                    <Clock3 />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-mono">
                        {item.componentCode}
                      </strong>
                      <span className="text-slate-400">→</span>
                      <StatusBadge status={item.toStatus} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.remark || '无备注'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{item.operatorName}</p>
                    <p>{dateTime(item.submittedAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <SmallEmpty icon={FileClock} title="暂无进度记录" />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function MembersView({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(
        await api<ProjectMember[]>(`/api/projects/${projectId}/members`),
      );
    } catch (loadError) {
      toast.add({
        title: '成员加载失败',
        description:
          loadError instanceof Error ? loadError.message : '请稍后重试',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const save = async (event: FormSubmitEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const member = await api<ProjectMember>(
        `/api/projects/${projectId}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(form)),
        },
      );
      await load();
      event.currentTarget.reset();
      toast.add({
        title: '成员权限已保存',
        description: `${member.displayName} · ${roleLabels[member.role]}`,
        type: 'success',
      });
    } catch (saveError) {
      toast.add({
        title: '保存失败',
        description:
          saveError instanceof Error ? saveError.message : '请稍后重试',
        type: 'error',
      });
    }
  };
  return (
    <>
      <PageTitle
        title="项目成员"
        description="按工厂、现场、查看与审计职责分配最小权限"
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw />
            刷新
          </Button>
        }
      />
      <div className="dashboard-grid">
        <Card className="component-card">
          <CardHeader>
            <CardTitle>成员列表</CardTitle>
            <CardDescription>
              当前项目共 {members.length} 名成员
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">成员</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>加入时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="pl-5">
                        <p className="font-medium">{member.displayName}</p>
                        <p className="text-xs text-slate-500">
                          {member.email || '微信账号'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {roleLabels[member.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>{dateTime(member.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>添加或调整成员</CardTitle>
            <CardDescription>
              {canManage
                ? '让成员复制登录后的成员 ID；微信成员的邮箱可以留空。'
                : '仅项目管理员可调整成员。'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage && (
              <form onSubmit={save} className="form-grid">
                <Field
                  label="成员 ID"
                  name="userId"
                  placeholder="wechat:… 或 ChatGPT 用户 ID"
                  required
                />
                <Field label="邮箱" name="email" placeholder="微信成员可留空" />
                <Field
                  label="显示名称"
                  name="displayName"
                  placeholder="留空时读取微信昵称"
                />
                <div className="field-group">
                  <Label htmlFor="member-role">项目角色</Label>
                  <Select name="role" defaultValue="VIEWER">
                    <SelectTrigger id="member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROJECT_ADMIN">项目管理员</SelectItem>
                      <SelectItem value="FACTORY_OPERATOR">
                        工厂录入员
                      </SelectItem>
                      <SelectItem value="SITE_OPERATOR">现场录入员</SelectItem>
                      <SelectItem value="VIEWER">查看者</SelectItem>
                      <SelectItem value="AUDITOR">审计员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="primary-action mt-1" type="submit">
                  <Users />
                  保存成员
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SettingsView({
  project,
  canManage,
  onSaved,
}: {
  project: Project;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  const [onsitePhoto, setOnsitePhoto] = useState(
    Boolean(project.requireOnsitePhoto),
  );
  const [completePhoto, setCompletePhoto] = useState(
    Boolean(project.requireCompletePhoto),
  );
  const update = async (payload: Record<string, unknown>) => {
    await api(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await onSaved();
  };
  const save = async (event: FormSubmitEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await update({
        ...Object.fromEntries(form),
        requireOnsitePhoto: onsitePhoto,
        requireCompletePhoto: completePhoto,
      });
      toast.add({
        title: '项目设置已保存',
        description: project.name,
        type: 'success',
      });
    } catch (saveError) {
      toast.add({
        title: '保存失败',
        description:
          saveError instanceof Error ? saveError.message : '请稍后重试',
        type: 'error',
      });
    }
  };
  const changeStatus = async () => {
    const next = project.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    if (
      next === 'ARCHIVED' &&
      !window.confirm('归档后将禁止新增构件和录入进度，确定继续吗？')
    )
      return;
    try {
      await update({
        status: next,
        name: project.name,
        address: project.address,
        owner: project.owner,
        requireOnsitePhoto: onsitePhoto,
        requireCompletePhoto: completePhoto,
      });
      toast.add({
        title: next === 'ARCHIVED' ? '项目已归档' : '项目已重新启用',
        description: project.name,
        type: 'success',
      });
    } catch (saveError) {
      toast.add({
        title: '操作失败',
        description:
          saveError instanceof Error ? saveError.message : '请稍后重试',
        type: 'error',
      });
    }
  };
  return (
    <>
      <PageTitle
        title="项目设置"
        description="维护项目档案、现场照片规则与归档状态"
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <div>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>
              {project.code} · 当前状态：
              {project.status === 'ARCHIVED' ? '已归档' : '进行中'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form onSubmit={save}>
              <div className="form-grid two-cols">
                <Field
                  label="项目名称"
                  name="name"
                  placeholder="项目名称"
                  defaultValue={project.name}
                  required
                />
                <Field
                  label="项目负责人"
                  name="owner"
                  placeholder="负责人姓名"
                  defaultValue={project.owner}
                />
                <div className="field-group md:col-span-2">
                  <Label htmlFor="project-address">项目地址</Label>
                  <Input
                    id="project-address"
                    name="address"
                    defaultValue={project.address}
                    placeholder="城市及施工地址"
                  />
                </div>
                <Label
                  htmlFor="require-onsite-photo"
                  className="flex items-center gap-3 rounded-lg border p-4"
                >
                  <Checkbox
                    id="require-onsite-photo"
                    checked={onsitePhoto}
                    onCheckedChange={setOnsitePhoto}
                  />
                  <span>
                    <strong className="block text-sm">
                      现场施工必须上传照片
                    </strong>
                    <small className="text-slate-500">
                      扫码推进到现场施工时至少留存一张现场照片
                    </small>
                  </span>
                </Label>
                <Label
                  htmlFor="require-complete-photo"
                  className="flex items-center gap-3 rounded-lg border p-4"
                >
                  <Checkbox
                    id="require-complete-photo"
                    checked={completePhoto}
                    onCheckedChange={setCompletePhoto}
                  />
                  <span>
                    <strong className="block text-sm">
                      安装完成必须上传照片
                    </strong>
                    <small className="text-slate-500">
                      形成最终安装验收的影像留痕
                    </small>
                  </span>
                </Label>
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <Button
                  type="button"
                  variant={
                    project.status === 'ARCHIVED' ? 'outline' : 'destructive'
                  }
                  onClick={() => void changeStatus()}
                >
                  {project.status === 'ARCHIVED' ? '重新启用项目' : '归档项目'}
                </Button>
                <Button type="submit" className="primary-action">
                  <Settings2 />
                  保存设置
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              当前角色可查看项目设置，但只有项目管理员可以修改。
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ProjectDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormSubmitEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建工程项目</DialogTitle>
          <DialogDescription>
            创建后，你将成为该项目的管理员。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <Field
              label="项目编码"
              name="code"
              placeholder="例如：BJ-IP-2026"
              required
            />
            <Field
              label="项目名称"
              name="name"
              placeholder="请输入完整项目名称"
              required
            />
            <Field
              label="项目地址"
              name="address"
              placeholder="城市及施工地址"
            />
            <Field label="项目负责人" name="owner" placeholder="负责人姓名" />
          </div>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" className="primary-action">
              创建项目
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ComponentDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormSubmitEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新增构件</DialogTitle>
          <DialogDescription>
            构件创建后将自动生成唯一二维码。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="form-grid two-cols">
            <Field
              label="构件编码"
              name="code"
              placeholder="PC-C1-0001"
              required
            />
            <Field
              label="构件名称"
              name="name"
              placeholder="预制柱 C1-001"
              required
            />
            <Field label="构件类型" name="type" placeholder="预制柱" required />
            <Field
              label="规格型号"
              name="specification"
              placeholder="600×600×3200"
            />
            <Field label="材质" name="material" placeholder="C40 混凝土" />
            <Field label="生产批次" name="batch" placeholder="PC-2609-01" />
            <Field label="楼栋" name="building" placeholder="1#楼" />
            <Field label="楼层" name="floor" placeholder="6F" />
            <Field label="区域/轴线" name="area" placeholder="A/3轴" />
            <div className="field-group md:col-span-2">
              <Label htmlFor="component-notes">备注</Label>
              <Textarea
                id="component-notes"
                name="notes"
                placeholder="选填，最多 1000 字"
              />
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" className="primary-action">
              创建并生成二维码
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ComponentSheet({
  id,
  canAdmin,
  onOpenChange,
  onUpdated,
  onProgress,
}: {
  id: string | null;
  canAdmin: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<void>;
  onProgress: (item: ComponentItem) => void;
}) {
  const [detail, setDetail] = useState<
    (ComponentDetail & { milestones?: Array<Record<string, string>> }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const modelRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setDetail(
        await api<
          ComponentDetail & { milestones?: Array<Record<string, string>> }
        >(`/api/components/${id}`),
      );
    } catch (loadError) {
      toast.add({
        title: '加载失败',
        description:
          loadError instanceof Error ? loadError.message : '请稍后重试',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const uploadModel = async (file?: File) => {
    if (!file || !id) return;
    const form = new FormData();
    form.set('file', file);
    try {
      await api(`/api/components/${id}/model`, { method: 'POST', body: form });
      await load();
      await onUpdated();
      toast.add({
        title: '模型上传完成',
        description: file.name,
        type: 'success',
      });
    } catch (uploadError) {
      toast.add({
        title: '模型上传失败',
        description:
          uploadError instanceof Error ? uploadError.message : '请检查文件',
        type: 'error',
      });
    }
  };
  const rollback = async () => {
    if (!detail) return;
    const reason = window.prompt('请输入状态回退原因（该操作会写入审计日志）');
    if (!reason?.trim()) return;
    try {
      await api(`/api/components/${detail.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentVersion: detail.version,
          reason,
          idempotencyKey: createIdempotencyKey(),
        }),
      });
      await load();
      await onUpdated();
      toast.add({
        title: '状态已回退',
        description: `${detail.code} 已回退一个阶段`,
        type: 'success',
      });
    } catch (rollbackError) {
      toast.add({
        title: '回退失败',
        description:
          rollbackError instanceof Error ? rollbackError.message : '请稍后重试',
        type: 'error',
      });
    }
  };
  return (
    <Sheet open={Boolean(id)} onOpenChange={onOpenChange}>
      <SheetContent className="component-sheet sm:max-w-3xl">
        <SheetHeader className="border-b">
          <SheetTitle>
            {detail ? `${detail.code} · ${detail.name}` : '构件详情'}
          </SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.projectName} · ${locationText(detail)}`
              : '正在加载构件档案'}
          </SheetDescription>
        </SheetHeader>
        {loading && !detail ? (
          <div className="flex flex-1 items-center justify-center">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          detail && (
            <div className="sheet-scroll">
              <div className="detail-top">
                <div>
                  <StatusBadge status={detail.currentStatus} />
                  <p className="mt-3 text-sm text-slate-500">
                    版本 {detail.version} · {detail.updatedBy || '系统'}更新于{' '}
                    {dateTime(detail.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canAdmin && detail.currentStatus !== 'UNRECORDED' && (
                    <Button variant="outline" onClick={() => void rollback()}>
                      回退状态
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      window.open(`/api/components/${detail.id}/qr`, '_blank')
                    }
                  >
                    <QrCode />
                    二维码
                  </Button>
                  {NEXT_STATUS[detail.currentStatus] && (
                    <Button
                      className="primary-action"
                      onClick={() => onProgress(detail)}
                    >
                      更新进度
                    </Button>
                  )}
                </div>
              </div>
              <section className="detail-section">
                <div className="section-title">
                  <div>
                    <h3>三维模型</h3>
                    <p>
                      {detail.modelFileName || '支持不超过 50 MB 的 GLB 文件'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canAdmin}
                    onClick={() => modelRef.current?.click()}
                  >
                    <Upload />
                    {detail.modelFileName ? '替换模型' : '上传 GLB'}
                  </Button>
                </div>
                <ModelViewer
                  url={
                    detail.modelFileName
                      ? `/api/components/${detail.id}/model`
                      : undefined
                  }
                  label={detail.code}
                />
                <input
                  ref={modelRef}
                  className="sr-only"
                  type="file"
                  accept=".glb,model/gltf-binary"
                  onChange={(event) =>
                    void uploadModel(event.target.files?.[0])
                  }
                />
              </section>
              <section className="detail-section">
                <div className="section-title">
                  <div>
                    <h3>构件档案</h3>
                    <p>生产与安装定位信息</p>
                  </div>
                </div>
                <div className="detail-fields">
                  <DetailField label="类型" value={detail.type} />
                  <DetailField label="规格" value={detail.specification} />
                  <DetailField label="材质" value={detail.material} />
                  <DetailField label="批次" value={detail.batch} />
                  <DetailField
                    label="楼栋/楼层"
                    value={[detail.building, detail.floor]
                      .filter(Boolean)
                      .join(' / ')}
                  />
                  <DetailField label="区域/轴线" value={detail.area} />
                </div>
              </section>
              <section className="detail-section">
                <div className="section-title">
                  <div>
                    <h3>现场照片</h3>
                    <p>{detail.photos.length} 张进度留痕</p>
                  </div>
                </div>
                {detail.photos.length ? (
                  <div className="photo-grid">
                    {detail.photos.map((photo) => (
                      <a
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        key={photo.id}
                      >
                        <img src={photo.url} alt={`${detail.code} 现场照片`} />
                        <span>{dateTime(photo.createdAt)}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <SmallEmpty icon={ImageIcon} title="暂无现场照片" />
                )}
              </section>
              <section className="detail-section">
                <div className="section-title">
                  <div>
                    <h3>进度时间轴</h3>
                    <p>历史记录只追加，不覆盖</p>
                  </div>
                </div>
                {detail.progress.length ? (
                  <div className="timeline">
                    {detail.progress.map((record) => (
                      <div className="timeline-item" key={record.id}>
                        <i />
                        <div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={record.toStatus} />
                            <span className="text-xs text-slate-500">
                              {dateTime(record.actualAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm">
                            {record.remark || '进度已更新'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {record.operatorName} · 提交于{' '}
                            {dateTime(record.submittedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SmallEmpty icon={Clock3} title="暂无进度记录" />
                )}
              </section>
            </div>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}

function QrDialog({
  component,
  canReset,
  onUpdated,
  onOpenChange,
}: {
  component: ComponentItem | null;
  canReset: boolean;
  onUpdated: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [token, setToken] = useState(component?.qrToken ?? '');
  const [revision, setRevision] = useState(0);
  const reset = async () => {
    if (!component || !window.confirm('旧二维码将立即失效，确定重新生成吗？'))
      return;
    try {
      const result = await api<{ qrToken: string }>(
        `/api/components/${component.id}/qr`,
        { method: 'POST' },
      );
      setToken(result.qrToken);
      setRevision((value) => value + 1);
      await onUpdated();
      toast.add({
        title: '二维码已重置',
        description: '请重新下载并替换旧标签',
        type: 'success',
      });
    } catch (resetError) {
      toast.add({
        title: '重置失败',
        description:
          resetError instanceof Error ? resetError.message : '请稍后重试',
        type: 'error',
      });
    }
  };
  return (
    <Dialog open={Boolean(component)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{component?.code} 构件二维码</DialogTitle>
          <DialogDescription>
            打印并粘贴到实体构件或流转单，扫码后进入专属录入页。
          </DialogDescription>
        </DialogHeader>
        {component && (
          <div className="qr-dialog">
            <img
              src={`/api/components/${component.id}/qr?v=${revision}`}
              alt={`${component.code} 二维码`}
            />
            <strong>{component.code}</strong>
            <span>
              {component.name} · {locationText(component)}
            </span>
          </div>
        )}
        <DialogFooter className="flex-wrap">
          {canReset && (
            <Button variant="outline" onClick={() => void reset()}>
              <RefreshCw />
              重置
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => component && window.open(`/q/${token}`, '_blank')}
          >
            <ScanLine />
            打开扫码页
          </Button>
          <Button
            className="primary-action"
            onClick={() =>
              component &&
              window.open(
                `/api/components/${component.id}/qr?download=1`,
                '_blank',
              )
            }
          >
            <Download />
            下载 SVG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgressDialog({
  component,
  onOpenChange,
  onSaved,
}: {
  component: ComponentItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const next = component ? NEXT_STATUS[component.currentStatus] : null;
  const submit = async (event: FormSubmitEvent) => {
    event.preventDefault();
    if (!component || !next) return;
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      const photoIds: string[] = [];
      for (const file of files) {
        const body = new FormData();
        body.set('file', file);
        const photo = await api<{ id: string }>(
          `/api/components/${component.id}/photos`,
          { method: 'POST', body },
        );
        photoIds.push(photo.id);
      }
      await api(`/api/components/${component.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus: next,
          actualAt: new Date(formText(formData, 'actualAt')).toISOString(),
          remark: formText(formData, 'remark'),
          photoIds,
          componentVersion: component.version,
          idempotencyKey: createIdempotencyKey(),
        }),
      });
      setFiles([]);
      toast.add({
        title: '进度更新成功',
        description: `${component.code} 已更新为${STATUS_LABELS[next]}`,
        type: 'success',
      });
      await onSaved();
    } catch (submitError) {
      toast.add({
        title: '提交失败',
        description:
          submitError instanceof Error ? submitError.message : '请稍后重试',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={Boolean(component)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>更新构件进度</DialogTitle>
          <DialogDescription>
            {component
              ? `${component.code}：${STATUS_LABELS[component.currentStatus]} → ${next ? STATUS_LABELS[next] : '已完成'}`
              : ''}
          </DialogDescription>
        </DialogHeader>
        {component && next && (
          <form onSubmit={submit}>
            <div className="space-y-4">
              <div className="field-group">
                <Label htmlFor="progress-time">实际发生时间</Label>
                <Input
                  id="progress-time"
                  name="actualAt"
                  type="datetime-local"
                  defaultValue={localDateInput()}
                  max={localDateInput()}
                  required
                />
              </div>
              <div className="field-group">
                <Label htmlFor="progress-remark">进度备注</Label>
                <Textarea
                  id="progress-remark"
                  name="remark"
                  placeholder="填写施工位置、完成情况或需要说明的问题"
                />
              </div>
              <div className="field-group">
                <Label htmlFor="progress-photos">
                  现场照片
                  {next === 'ONSITE' || next === 'COMPLETED'
                    ? '（至少 1 张）'
                    : '（选填）'}
                </Label>
                <label className="upload-zone" htmlFor="progress-photos">
                  <Upload />
                  <span>拍照或选择图片</span>
                  <small>JPG / PNG / WebP，单张不超过 20 MB</small>
                </label>
                <input
                  id="progress-photos"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  capture="environment"
                  onChange={(event) =>
                    setFiles(Array.from(event.target.files ?? []).slice(0, 9))
                  }
                />
                {files.length > 0 && (
                  <div className="file-chips">
                    {files.map((file, index) => (
                      <span key={`${file.name}-${index}`}>
                        {file.name}
                        <button
                          type="button"
                          aria-label={`移除 ${file.name}`}
                          onClick={() =>
                            setFiles((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          <X />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="primary-action"
                disabled={
                  saving ||
                  ((next === 'ONSITE' || next === 'COMPLETED') &&
                    files.length === 0)
                }
              >
                {saving && <LoaderCircle className="animate-spin" />}确认更新为
                {STATUS_LABELS[next]}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="field-group">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
      />
    </div>
  );
}
function DetailField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}
function PageTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <h1 className="mt-0!">{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </section>
  );
}
function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Boxes;
  tone: 'navy' | 'blue' | 'orange' | 'green';
}) {
  return (
    <Card className="metric-card">
      <CardContent className="flex items-start justify-between">
        <div>
          <p className="metric-label">{label}</p>
          <strong className="metric-value">
            {value.toLocaleString('zh-CN')}
          </strong>
          <p className="metric-detail">{detail}</p>
        </div>
        <span className={`metric-icon metric-icon-${tone}`}>
          <Icon />
        </span>
      </CardContent>
    </Card>
  );
}
function Stage({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="stage-row">
      <span>
        <i className={`stage-dot stage-${color}`} />
        {label}
      </span>
      <strong>{value.toLocaleString('zh-CN')}</strong>
      <div>
        <i
          className={`stage-bar stage-${color}`}
          style={{ width: value ? '70%' : '0%' }}
        />
      </div>
    </div>
  );
}
function StatusBadge({ status }: { status: ComponentStatus }) {
  return (
    <Badge variant="outline" className={statusClass[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
function SmallEmpty({
  icon: Icon,
  title,
}: {
  icon: typeof Boxes;
  title: string;
}) {
  return (
    <Empty className="min-h-40 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
function percent(value: number, total: number) {
  return `占全部构件 ${total ? ((value / total) * 100).toFixed(1) : '0.0'}%`;
}
function locationText(
  component: Pick<ComponentItem, 'building' | 'floor' | 'area'>,
) {
  return (
    [component.building, component.floor, component.area]
      .filter(Boolean)
      .join(' · ') || '未设置'
  );
}
function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
}
function localDateInput() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}
function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('CSV 文件至少需要表头和一行数据');
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ''));
  return rows
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? '']),
      ),
    );
}
