import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useListScrollMargin } from './useListScrollMargin';

const box = (top: number) => ({ top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) });

describe('useListScrollMargin', () => {
  it('is the distance from the top of the scroll container to the list, scrolled or not', () => {
    const scroller = document.createElement('div');
    scroller.getBoundingClientRect = () => box(100);
    scroller.scrollTop = 0;
    const list = document.createElement('div');
    // 700 px of other content above the list, scrolled by 300 px
    Object.defineProperty(scroller, 'scrollTop', { value: 300 });
    list.getBoundingClientRect = () => box(100 + 700 - 300);
    const { result } = renderHook(() => useListScrollMargin(scroller));
    expect(result.current.scrollMargin).toBe(0);
    act(() => result.current.listRef(list));
    expect(result.current.scrollMargin).toBe(700);
  });
});
