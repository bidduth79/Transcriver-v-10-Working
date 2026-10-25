import { describe, it, expect } from 'vitest';
import { useProcessingView } from './useProcessingView';

describe('useProcessingView', () => {
  it('counts down to the estimate, then says it is running over instead of sitting at 00:00', () => {
    expect(useProcessingView(120, 30)).toMatchObject({ remainingSeconds: 90, isOvertime: false });
    expect(useProcessingView(120, 200)).toMatchObject({ remainingSeconds: 0, isOvertime: true });
    expect(useProcessingView(120, 30).formatTime(75)).toBe('01:15');
  });
});
