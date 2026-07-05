import { IsUrl } from 'class-validator';

/**
 * Gallery entries are URL-based in this phase; real file upload arrives
 * with the FileStorage port (see docs/arquitectura.md §2, security.md A12).
 */
export class AddImageDto {
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url!: string;
}
