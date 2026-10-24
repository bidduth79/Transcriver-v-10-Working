import { codeOf, messageOf } from '../../utils/errorMessage';

export type PullFailure = 'quota' | 'failed';

// Firestore answers 'resource-exhausted' ("Quota exceeded") once the project's daily free reads are used up
export const pullFailureOf = (err: unknown): PullFailure =>
  codeOf(err) === 'resource-exhausted' || /quota/i.test(messageOf(err) ?? '') ? 'quota' : 'failed';

// locales/ui key of the message shown for each kind of failed pull
export const PULL_FAILURE_TEXT = { quota: 'firebaseQuotaExceeded', failed: 'firebasePullFailed' } as const;
