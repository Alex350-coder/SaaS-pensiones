import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { paginated } from './paginated';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PaginationQueryDto,
} from './pagination-query.dto';

describe('paginated', () => {
  it('builds meta with total pages rounded up', () => {
    const result = paginated(['a', 'b'], 41, { page: 2, limit: 20 });

    expect(result.items).toEqual(['a', 'b']);
    expect(result.meta).toEqual({ total: 41, page: 2, limit: 20, totalPages: 3 });
  });

  it('reports zero pages for an empty collection', () => {
    const result = paginated([], 0, { page: 1, limit: 20 });

    expect(result.meta.totalPages).toBe(0);
  });
});

describe('PaginationQueryDto', () => {
  const buildDto = (plain: Record<string, unknown>): PaginationQueryDto =>
    plainToInstance(PaginationQueryDto, plain);

  it('defaults page and limit', async () => {
    const dto = buildDto({});

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('computes skip from page and limit', () => {
    const dto = buildDto({ page: '3', limit: '10' });

    expect(dto.skip).toBe(20);
  });

  it('rejects page below 1', async () => {
    const errors = await validate(buildDto({ page: '0' }));

    expect(errors.map((e) => e.property)).toContain('page');
  });

  it('rejects limit above the maximum', async () => {
    const errors = await validate(buildDto({ limit: `${MAX_PAGE_SIZE + 1}` }));

    expect(errors.map((e) => e.property)).toContain('limit');
  });

  it('rejects non-numeric values', async () => {
    const errors = await validate(buildDto({ page: 'abc' }));

    expect(errors.map((e) => e.property)).toContain('page');
  });
});
