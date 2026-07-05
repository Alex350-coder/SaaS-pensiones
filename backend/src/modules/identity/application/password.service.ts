import { Inject, Injectable, Optional } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

/** docs/security.md §4: bcrypt cost >= 12. */
export const BCRYPT_COST = 12;

/** Override only in tests (low cost keeps suites fast). */
export const PASSWORD_HASH_COST = Symbol('PASSWORD_HASH_COST');

@Injectable()
export class PasswordService {
  private readonly cost: number;

  constructor(@Optional() @Inject(PASSWORD_HASH_COST) cost?: number) {
    this.cost = cost ?? BCRYPT_COST;
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
