import QRCode from 'qrcode/lib/browser.js';
import { getEntryGroup } from '@/lib/entry-repository';
import { jsonError, requireActor, requireProjectAccess } from '@/lib/server';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const group = await getEntryGroup(id);
    await requireProjectAccess(actor, group.projectId, 'read');
    const target = `${new URL(request.url).origin}/entry/${group.qrToken}`;
    const svg = await QRCode.toString(target, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 420,
      color: { dark: '#14213a', light: '#ffffff' },
    });
    const download = new URL(request.url).searchParams.get('download') === '1';
    const fileName = `${group.typeCode}-${group.locationCode}-entry-qr.svg`.replaceAll(
      /[^A-Za-z0-9_-]/g,
      '_',
    );
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
        ...(download
          ? { 'Content-Disposition': `attachment; filename="${fileName}"` }
          : {}),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
