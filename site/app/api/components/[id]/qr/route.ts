import QRCode from 'qrcode/lib/browser.js';
import { writeAudit } from '@/lib/repository';
import { database, HttpError, jsonError, jsonOk, makeQrToken, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const component = await database().one<{ projectId: string; code: string; name: string; qrToken: string }>(`SELECT project_id AS "projectId", code, name, qr_token AS "qrToken" FROM components WHERE id = $1 AND disabled_at IS NULL`, [id]);
    if (!component) throw new HttpError(404, '未找到该构件');
    await requireProjectAccess(actor, component.projectId, 'read');
    const target = `${new URL(request.url).origin}/q/${component.qrToken}`;
    const svg = await QRCode.toString(target, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, width: 420, color: { dark: '#14213a', light: '#ffffff' } });
    const download = new URL(request.url).searchParams.get('download') === '1';
    return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'private, max-age=300', ...(download ? { 'Content-Disposition': `attachment; filename="${component.code.replaceAll(/[^A-Za-z0-9_-]/g, '_')}-qr.svg"` } : {}) } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const component = await database().one<{ projectId: string; oldToken: string }>(`SELECT project_id AS "projectId", qr_token AS "oldToken" FROM components WHERE id = $1 AND disabled_at IS NULL`, [id]);
    if (!component) throw new HttpError(404, '未找到该构件');
    await requireProjectAccess(actor, component.projectId, 'admin');
    const qrToken = makeQrToken();
    await database().transaction(async (tx) => {
      await tx.execute(`UPDATE components SET qr_token = $1, version = version + 1, updated_at = $2 WHERE id = $3`, [qrToken, new Date().toISOString(), id]);
      await writeAudit(tx, request, actor, 'QR_TOKEN_REGENERATED', 'component', id, component.projectId, { tokenRevoked: true }, { tokenRegenerated: true });
    });
    return jsonOk({ id, qrToken });
  } catch (error) { return jsonError(error); }
}
