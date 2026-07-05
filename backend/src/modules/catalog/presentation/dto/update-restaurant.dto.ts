import { PartialType } from '@nestjs/mapped-types';
import { CreateRestaurantDto } from './create-restaurant.dto';

/**
 * Every profile field optional. The slug is intentionally NOT updatable:
 * public URLs stay stable after creation, whatever happens to the name.
 *
 * skipNullProperties: false — with the default, an explicit `null` would
 * skip ALL validators and reach Prisma against NOT NULL columns (500).
 * This way `null` values are validated (and rejected) like any other value.
 */
export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto, {
  skipNullProperties: false,
}) {}
