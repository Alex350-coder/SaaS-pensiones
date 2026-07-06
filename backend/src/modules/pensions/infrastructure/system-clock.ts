import { Injectable } from '@nestjs/common';
import { todayUtc } from '../../../core/dates/utc-date';
import { Clock } from '../application/ports/clock.port';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  todayUtc(): Date {
    return todayUtc();
  }
}
