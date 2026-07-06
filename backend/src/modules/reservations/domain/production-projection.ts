/**
 * Production projection math (roadmap F7: "la proyección de producción agrega
 * correctamente reservas + confirmaciones + pensionarios sin respuesta").
 * Pure: no Nest, no Prisma.
 *
 * The projection partitions the restaurant's ACTIVE pensioners whose coverage
 * includes the day into three buckets: will attend, will not attend, and
 * unanswered. Answers left behind by pensions that later stopped being ACTIVE
 * are excluded by the caller, so the partition always adds up.
 *
 * `projectedAttendance` is the conservative kitchen figure: confirmed
 * attendees plus everyone who has not answered yet.
 */
export interface ProjectionCounts {
  /** ACTIVE pensions of the restaurant covering the day. */
  activePensioners: number;
  /** WILL_ATTEND answers among those pensions. */
  willAttend: number;
  /** WILL_NOT_ATTEND answers among those pensions. */
  willNotAttend: number;
  /** CONFIRMED reservations against the day's menu. */
  confirmedReservations: number;
}

export interface ProductionProjection {
  reservations: { confirmed: number };
  attendance: { willAttend: number; willNotAttend: number };
  pensioners: { active: number; unanswered: number };
  projectedAttendance: number;
}

export function buildProjection(counts: ProjectionCounts): ProductionProjection {
  const answered = counts.willAttend + counts.willNotAttend;
  const unanswered = Math.max(0, counts.activePensioners - answered);
  return {
    reservations: { confirmed: counts.confirmedReservations },
    attendance: {
      willAttend: counts.willAttend,
      willNotAttend: counts.willNotAttend,
    },
    pensioners: { active: counts.activePensioners, unanswered },
    projectedAttendance: counts.willAttend + unanswered,
  };
}
