import { PensionStatus } from './pension';

/** Typed domain errors: `code` is the stable English slug, message Spanish. */
export class PensionDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class LivePensionExistsError extends PensionDomainError {
  constructor() {
    super(
      'PENSION_ALREADY_EXISTS',
      'Ya tienes una pensión vigente en este restaurante.',
    );
  }
}

export class InvalidPensionTransitionError extends PensionDomainError {
  constructor(from: PensionStatus, to: PensionStatus) {
    super(
      'INVALID_STATUS_TRANSITION',
      `No se puede pasar la pensión de ${from} a ${to}.`,
    );
  }
}
