import { displayBrand, displayColor, displayModel, imageFileName, parseCarImageUrl } from './car-image-request.js';

const ferrari =
  'https://carimage.dev/images/car.png?view=front-3-4&brand=ferrari&model=812-competizione&year=2024&color=black&w=600&format=webp';

describe('parseCarImageUrl', () => {
  it('reads a carimage vehicle link', () => {
    expect(parseCarImageUrl(ferrari)).toEqual({
      makeSlug: 'ferrari',
      modelSlug: '812-competizione',
      year: 2024,
      color: 'black',
      view: 'front-3-4',
      width: 600,
      format: 'webp',
    });
  });

  it('rejects a link from another site', () => {
    expect(() => parseCarImageUrl('https://example.com/car.png?brand=ferrari&model=812&year=2024&color=black')).toThrow(
      '请粘贴 carimage.dev 的车辆图片链接',
    );
  });

  it('rejects a link without a model', () => {
    expect(() => parseCarImageUrl('https://carimage.dev/images/car.png?brand=ferrari&year=2024&color=black')).toThrow(
      '链接里缺少车型',
    );
  });
});

describe('vehicle display names', () => {
  it('uses the Chinese brand and color, and a readable model name', () => {
    const request = parseCarImageUrl(ferrari);
    expect(displayBrand(request.makeSlug, 'FERRARI')).toBe('法拉利');
    expect(displayModel('812 COMPETIZIONE')).toBe('812 Competizione');
    expect(displayColor(request.color)).toBe('黑色');
    expect(imageFileName(request)).toBe('ferrari-812-competizione-2024-black-front-3-4.webp');
  });
});
