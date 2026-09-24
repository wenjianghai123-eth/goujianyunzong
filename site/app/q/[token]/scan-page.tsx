'use client';
/* oxlint-disable next/no-img-element next/no-html-link-for-pages */

import { useCallback, useEffect, useState } from 'react';
import { Box, Camera, Check, CheckCircle2, ChevronRight, Clock3, Factory, HardHat, ImageIcon, LoaderCircle, LogOut, MapPin, PackageCheck, RefreshCw, Truck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Toaster, toast } from '@/components/ui/toast';
import { ModelViewer } from '@/app/model-viewer';
import { createIdempotencyKey } from '@/lib/client-id';
import { NEXT_STATUS, STATUS_LABELS, type ComponentDetail, type ComponentStatus } from '@/lib/domain';

type Detail = ComponentDetail & { requireOnsitePhoto: boolean; requireCompletePhoto: boolean; milestones: Array<{ id: string; type: string; actualAt: string; operatorName: string; vehicleNo: string; receiver: string; location: string; remark: string }> };
type FormSubmitEvent = { preventDefault(): void; currentTarget: HTMLFormElement };
type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json() as Envelope<T>;
  if (!response.ok || !result.ok) throw new Error(result.ok ? '请求失败' : result.error.message);
  return result.data;
}

export function ScanPage({ token, displayName }: { token: string; displayName: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progressOpen, setProgressOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [milestone, setMilestone] = useState<'FACTORY_EXIT' | 'SITE_ENTRY' | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setDetail(await api<Detail>(`/api/q/${token}`)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '构件加载失败'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  if (loading) return <main className="scan-shell"><div className="scan-loading"><LoaderCircle className="animate-spin" /><p>正在识别构件…</p></div></main>;
  if (error || !detail) return <main className="scan-shell"><div className="scan-error"><div className="mobile-logo">!</div><h1>无法打开构件</h1><p>{error || '二维码无效或已失效'}</p><Button variant="outline" onClick={() => void load()}><RefreshCw />重新加载</Button></div></main>;

  const next = NEXT_STATUS[detail.currentStatus];
  return (
    <Toaster>
      <main className="scan-shell">
        <header className="scan-header"><div className="flex items-center gap-10"><div className="mobile-logo">构</div><div><strong>构件云踪</strong><span>{detail.projectName} · {displayName}</span></div></div><a className="scan-signout" aria-label="退出登录" href="/signout-with-chatgpt?return_to=/" target="_top"><LogOut /><span className="sr-only">退出登录</span></a></header>
        <section className="scan-summary">
          <div className="scan-code-row"><div><p>构件编码</p><h1>{detail.code}</h1></div><StatusBadge status={detail.currentStatus} /></div>
          <h2>{detail.name}</h2>
          <div className="scan-meta"><span><Box />{detail.type}</span><span><MapPin />{[detail.building, detail.floor, detail.area].filter(Boolean).join(' / ') || '未设置安装位置'}</span></div>
        </section>
        <section className="mobile-stage-card" aria-label="构件进度">
          <StageItem icon={Factory} label="加工中" active={detail.currentStatus === 'PROCESSING'} done={['ONSITE', 'COMPLETED'].includes(detail.currentStatus)} />
          <i />
          <StageItem icon={HardHat} label="现场施工" active={detail.currentStatus === 'ONSITE'} done={detail.currentStatus === 'COMPLETED'} />
          <i />
          <StageItem icon={CheckCircle2} label="安装完成" active={detail.currentStatus === 'COMPLETED'} done={false} />
        </section>
        <section className="scan-actions">
          <Button variant="outline" onClick={() => setModelOpen(true)}><Box />查看模型</Button>
          <Button variant="outline" onClick={() => setMilestone('FACTORY_EXIT')}><Truck />登记出厂</Button>
          <Button variant="outline" onClick={() => setMilestone('SITE_ENTRY')}><PackageCheck />登记进场</Button>
        </section>
        <Card className="scan-history"><CardContent><div className="mobile-section-title"><div><h3>最近记录</h3><p>照片、里程碑与状态变更</p></div><Badge variant="secondary">{detail.progress.length + detail.milestones.length} 条</Badge></div>{detail.progress.length || detail.milestones.length ? <div className="mobile-timeline">{[...detail.progress.map((item) => ({ id: item.id, title: STATUS_LABELS[item.toStatus], operator: item.operatorName, time: item.actualAt, remark: item.remark, type: 'progress' })), ...detail.milestones.map((item) => ({ id: item.id, title: item.type === 'FACTORY_EXIT' ? '构件出厂' : '构件进场', operator: item.operatorName, time: item.actualAt, remark: item.remark, type: 'milestone' }))].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6).map((item) => <div className="mobile-timeline-row" key={item.id}><span className={item.type === 'progress' ? 'blue' : 'orange'}>{item.type === 'progress' ? <Clock3 /> : <Truck />}</span><div><strong>{item.title}</strong><p>{item.remark || '已完成节点登记'}</p><small>{item.operator} · {dateTime(item.time)}</small></div></div>)}</div> : <div className="mobile-empty"><Clock3 /><p>暂无流转记录</p></div>}</CardContent></Card>
        {detail.photos.length > 0 && <Card className="scan-photos"><CardContent><div className="mobile-section-title"><div><h3>现场照片</h3><p>共 {detail.photos.length} 张</p></div><ImageIcon /></div><div className="mobile-photo-grid">{detail.photos.map((photo) => <a href={photo.url} target="_blank" rel="noreferrer" key={photo.id}><img src={photo.url} alt={`${detail.code} 现场照片`} /></a>)}</div></CardContent></Card>}
        <div className="scan-safe-space" />
        <div className="scan-submit-bar"><div><small>当前进度</small><strong>{STATUS_LABELS[detail.currentStatus]}</strong></div>{next ? <Button className="primary-action" size="lg" onClick={() => setProgressOpen(true)}>更新为{STATUS_LABELS[next]}<ChevronRight /></Button> : <Button variant="secondary" disabled><Check />构件已安装完成</Button>}</div>
      </main>

      <Dialog open={modelOpen} onOpenChange={setModelOpen}><DialogContent className="model-mobile-dialog"><DialogHeader><DialogTitle>{detail.code} 三维模型</DialogTitle><DialogDescription>{detail.modelFileName || '当前显示构件占位体'}</DialogDescription></DialogHeader><ModelViewer url={detail.modelFileName ? `/api/components/${detail.id}/model` : undefined} label={detail.code} /></DialogContent></Dialog>
      <MobileProgressDialog detail={detail} open={progressOpen} onOpenChange={setProgressOpen} onSaved={load} />
      <MilestoneDialog detail={detail} type={milestone} onOpenChange={(open) => !open && setMilestone(null)} onSaved={load} />
    </Toaster>
  );
}

function MobileProgressDialog({ detail, open, onOpenChange, onSaved }: { detail: Detail; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const next = NEXT_STATUS[detail.currentStatus];
  const submit = async (event: FormSubmitEvent) => { event.preventDefault(); if (!next) return; setSaving(true); const formData = new FormData(event.currentTarget); try { const photoIds: string[] = []; for (const file of files) { const upload = new FormData(); upload.set('file', file); const photo = await api<{ id: string }>(`/api/components/${detail.id}/photos`, { method: 'POST', body: upload }); photoIds.push(photo.id); } await api(`/api/components/${detail.id}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: next, actualAt: new Date(formText(formData, 'actualAt')).toISOString(), remark: formText(formData, 'remark'), photoIds, componentVersion: detail.version, idempotencyKey: createIdempotencyKey() }) }); setFiles([]); onOpenChange(false); toast.add({ title: '提交成功', description: `${detail.code} 已更新为${STATUS_LABELS[next]}`, type: 'success' }); await onSaved(); } catch (submitError) { toast.add({ title: '提交失败', description: submitError instanceof Error ? submitError.message : '请稍后重试', type: 'error' }); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="mobile-form-dialog"><DialogHeader><DialogTitle>更新为{next ? STATUS_LABELS[next] : '安装完成'}</DialogTitle><DialogDescription>{detail.code} · 本次提交会记录操作人和服务端时间</DialogDescription></DialogHeader>{next && <form onSubmit={submit}><div className="space-y-4"><div className="field-group"><Label htmlFor="mobile-progress-time">实际发生时间</Label><Input id="mobile-progress-time" name="actualAt" type="datetime-local" defaultValue={localDateInput()} max={localDateInput()} required /></div><div className="field-group"><Label htmlFor="mobile-progress-note">现场备注</Label><Textarea id="mobile-progress-note" name="remark" placeholder="填写安装位置、施工情况或问题说明" /></div><div className="field-group"><Label htmlFor="mobile-progress-files">现场照片{next === 'ONSITE' || next === 'COMPLETED' ? '（必填）' : ''}</Label><label htmlFor="mobile-progress-files" className="mobile-camera"><Camera /><strong>拍摄现场照片</strong><span>也可以从手机相册中选择</span></label><input id="mobile-progress-files" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 9))} />{files.length > 0 && <div className="file-chips">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}><X /></button></span>)}</div>}</div></div><DialogFooter className="mt-5"><Button variant="outline" type="button" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" className="primary-action" disabled={saving || ((next === 'ONSITE' || next === 'COMPLETED') && !files.length)}>{saving && <LoaderCircle className="animate-spin" />}确认提交</Button></DialogFooter></form>}</DialogContent></Dialog>;
}

function MilestoneDialog({ detail, type, onOpenChange, onSaved }: { detail: Detail; type: 'FACTORY_EXIT' | 'SITE_ENTRY' | null; onOpenChange: (open: boolean) => void; onSaved: () => Promise<void> }) {
  const submit = async (event: FormSubmitEvent) => { event.preventDefault(); if (!type) return; const form = new FormData(event.currentTarget); try { await api(`/api/components/${detail.id}/milestones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, actualAt: new Date(formText(form, 'actualAt')).toISOString(), vehicleNo: formText(form, 'vehicleNo'), receiver: formText(form, 'receiver'), location: formText(form, 'location'), remark: formText(form, 'remark') }) }); onOpenChange(false); toast.add({ title: type === 'FACTORY_EXIT' ? '出厂登记完成' : '进场登记完成', description: detail.code, type: 'success' }); await onSaved(); } catch (submitError) { toast.add({ title: '登记失败', description: submitError instanceof Error ? submitError.message : '请稍后重试', type: 'error' }); } };
  return <Dialog open={Boolean(type)} onOpenChange={onOpenChange}><DialogContent className="mobile-form-dialog"><DialogHeader><DialogTitle>{type === 'FACTORY_EXIT' ? '登记构件出厂' : '登记构件进场'}</DialogTitle><DialogDescription>{detail.code} · 里程碑不会改变主进度</DialogDescription></DialogHeader><form onSubmit={submit}><div className="space-y-4"><div className="field-group"><Label htmlFor="milestone-time">实际发生时间</Label><Input id="milestone-time" name="actualAt" type="datetime-local" defaultValue={localDateInput()} required /></div><div className="field-group"><Label htmlFor="vehicle-no">运输车辆</Label><Input id="vehicle-no" name="vehicleNo" placeholder="选填，例如：沪A·12345" /></div>{type === 'SITE_ENTRY' && <><div className="field-group"><Label htmlFor="receiver">现场接收人</Label><Input id="receiver" name="receiver" placeholder="选填" /></div><div className="field-group"><Label htmlFor="site-location">进场位置</Label><Input id="site-location" name="location" placeholder="选填，例如：1#门卸货区" /></div></>}<div className="field-group"><Label htmlFor="milestone-note">备注</Label><Textarea id="milestone-note" name="remark" placeholder="选填" /></div></div><DialogFooter className="mt-5"><Button variant="outline" type="button" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" className="primary-action">确认登记</Button></DialogFooter></form></DialogContent></Dialog>;
}

function StageItem({ icon: Icon, label, active, done }: { icon: typeof Factory; label: string; active: boolean; done: boolean }) { return <div className={`mobile-stage ${active ? 'active' : ''} ${done ? 'done' : ''}`}><span>{done ? <Check /> : <Icon />}</span><small>{label}</small></div>; }
function StatusBadge({ status }: { status: ComponentStatus }) { const classes: Record<ComponentStatus, string> = { UNRECORDED: 'status-unrecorded', PROCESSING: 'status-processing', ONSITE: 'status-onsite', COMPLETED: 'status-complete' }; return <Badge variant="outline" className={classes[status]}>{STATUS_LABELS[status]}</Badge>; }
function localDateInput() { const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); }
function dateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
function formText(form: FormData, key: string) { const value = form.get(key); return typeof value === 'string' ? value : ''; }
