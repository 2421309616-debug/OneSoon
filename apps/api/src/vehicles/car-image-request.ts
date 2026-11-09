export type CarImageRequest = {
  makeSlug: string;
  modelSlug: string;
  year: number;
  color: string;
  view: string;
  width: number | null;
  format: 'webp' | 'png' | 'jpg';
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BRANDS: Record<string, string> = {
  aion: '埃安',
  audi: '奥迪',
  bmw: '宝马',
  buick: '别克',
  byd: '比亚迪',
  changan: '长安',
  chevrolet: '雪佛兰',
  ferrari: '法拉利',
  ford: '福特',
  gac: '广汽',
  geely: '吉利',
  honda: '本田',
  hyundai: '现代',
  kia: '起亚',
  lexus: '雷克萨斯',
  mazda: '马自达',
  'mercedes-benz': '奔驰',
  mercedes: '奔驰',
  nissan: '日产',
  tesla: '特斯拉',
  toyota: '丰田',
  volkswagen: '大众',
  wuling: '五菱',
};

const COLORS: Record<string, string> = {
  beige: '米色',
  black: '黑色',
  blue: '蓝色',
  brown: '棕色',
  burgundy: '酒红',
  gold: '金色',
  gray: '灰色',
  green: '绿色',
  orange: '橙色',
  purple: '紫色',
  red: '红色',
  silver: '银色',
  tan: '棕褐',
  white: '白色',
  yellow: '黄色',
};

export function parseCarImageUrl(input: string): CarImageRequest {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('请粘贴 carimage.dev 的车辆图片链接');
  }
  if (url.hostname !== 'carimage.dev') {
    throw new Error('请粘贴 carimage.dev 的车辆图片链接');
  }

  const brand = url.searchParams.get('brand');
  const make = url.searchParams.get('make');
  if (brand && make && brand.toLowerCase() !== make.toLowerCase()) {
    throw new Error('链接里的品牌不一致');
  }
  const makeSlug = (brand ?? make ?? '').toLowerCase();
  const modelSlug = (url.searchParams.get('model') ?? '').toLowerCase();
  const year = Number(url.searchParams.get('year'));
  const color = (url.searchParams.get('color') ?? url.searchParams.get('paint') ?? '')
    .replace(/^#/, '')
    .toLowerCase();
  const view = (url.searchParams.get('view') ?? url.searchParams.get('angle') ?? 'front-3-4').toLowerCase();
  const width = parseWidth(url.searchParams.get('w'));
  const format = parseFormat(url.searchParams.get('format') ?? 'webp');

  if (!SLUG.test(makeSlug)) throw new Error('链接里缺少品牌');
  if (!SLUG.test(modelSlug)) throw new Error('链接里缺少车型');
  if (!Number.isInteger(year) || year < 1990 || year > 2027) throw new Error('链接里的年份不正确');
  if (!SLUG.test(color) && !/^[0-9a-f]{6}$/.test(color)) throw new Error('链接里缺少颜色');
  if (!SLUG.test(view)) throw new Error('链接里的角度不正确');

  return { makeSlug, modelSlug, year, color, view, width, format };
}

export function displayBrand(makeSlug: string, catalogName: string): string {
  return BRANDS[makeSlug] ?? displayModel(catalogName);
}

export function displayModel(catalogName: string): string {
  if (catalogName !== catalogName.toUpperCase()) return catalogName;
  return catalogName
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, separator: string, letter: string) => separator + letter.toUpperCase());
}

export function displayColor(color: string): string {
  return COLORS[color] ?? (/^[0-9a-f]{6}$/.test(color) ? `#${color.toUpperCase()}` : color);
}

export function imageFileName(request: CarImageRequest): string {
  return `${request.makeSlug}-${request.modelSlug}-${request.year}-${request.color}-${request.view}.${request.format}`;
}

function parseWidth(value: string | null): number | null {
  if (!value) return null;
  const width = Number(value);
  if (!Number.isInteger(width) || width < 1 || width > 2560) throw new Error('链接里的宽度不正确');
  return width;
}

function parseFormat(value: string): CarImageRequest['format'] {
  if (value === 'jpeg') return 'jpg';
  if (value === 'webp' || value === 'png' || value === 'jpg') return value;
  throw new Error('请指定 webp、png 或 jpg');
}
