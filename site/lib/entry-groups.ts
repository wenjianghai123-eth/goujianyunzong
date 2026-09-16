import { HttpError } from './server';

const MAX_SEQUENCE = 99_999_999;
export const MAX_BATCH_COMPONENTS = 200;

export function normalizeCodeSegment(value: unknown, label: string) {
  const segment = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!segment) throw new HttpError(400, `${label}不能为空`);
  if (segment.length > 20) throw new HttpError(400, `${label}不能超过 20 个字符`);
  if (!/^[\p{L}\p{N}_]+$/u.test(segment)) {
    throw new HttpError(400, `${label}仅支持中文、字母、数字和下划线`);
  }
  return segment;
}

export function parseSerialExpression(value: unknown) {
  const original = typeof value === 'string' ? value.trim() : '';
  if (!original) throw new HttpError(400, '请输入构件编号或编号范围');
  const normalized = original
    .replaceAll(/[，、；;]/g, ',')
    .replaceAll(/[—–－~～]/g, '-')
    .replaceAll(/\s+/g, '');
  const values = new Set<number>();
  for (const part of normalized.split(',')) {
    if (!part) throw new HttpError(400, '编号格式不正确，请检查多余的逗号');
    const range = /^(\d+)-(\d+)$/.exec(part);
    const single = /^\d+$/.test(part);
    if (!range && !single) {
      throw new HttpError(400, `编号“${part}”格式不正确，可输入 1-8 或 1-3,5,8-10`);
    }
    const start = Number(range?.[1] ?? part);
    const end = Number(range?.[2] ?? part);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end > MAX_SEQUENCE) {
      throw new HttpError(400, `编号应为 1 到 ${MAX_SEQUENCE} 之间的整数`);
    }
    if (start > end) throw new HttpError(400, `编号范围“${part}”应从小到大填写`);
    if (end - start + 1 > MAX_BATCH_COMPONENTS) {
      throw new HttpError(400, `单个编号范围最多包含 ${MAX_BATCH_COMPONENTS} 个构件`);
    }
    for (let number = start; number <= end; number += 1) {
      values.add(number);
      if (values.size > MAX_BATCH_COMPONENTS) {
        throw new HttpError(400, `单次最多登记 ${MAX_BATCH_COMPONENTS} 个构件`);
      }
    }
  }
  return [...values].sort((a, b) => a - b);
}

export function makeComponentCode(
  typeCode: string,
  locationCode: string,
  sequenceNo: number,
  serialWidth: number,
) {
  return `${typeCode}-${locationCode}-${String(sequenceNo).padStart(serialWidth, '0')}`;
}

export function normalizeSerialWidth(value: unknown) {
  const width = Number(value);
  if (!Number.isInteger(width) || width < 1 || width > 8) {
    throw new HttpError(400, '编号位数应为 1 到 8 位整数');
  }
  return width;
}
