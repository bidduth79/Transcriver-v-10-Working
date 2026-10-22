import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { InteractiveDotBackground } from './Background';

// Recording 2D context: keeps the styles used for dots and lines
const makeCtx = () => {
  const log: string[] = [];
  const ctx: any = {
    clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: () => log.push(`fill ${ctx.fillStyle}`),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: () => log.push(`stroke ${ctx.lineWidth}`),
  };
  return { ctx, log };
};

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('InteractiveDotBackground', () => {
  it('renders the backdrop for dark and light themes', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(render(<InteractiveDotBackground />).container.innerHTML).toMatchSnapshot('dark');
    expect(render(<InteractiveDotBackground isDark={false} />).container.innerHTML).toMatchSnapshot('light');
  });

  it.each([[true, 'rgba(255, 255, 255, 0.6)'], [false, 'rgba(99, 102, 241, 0.8)']])('draws 15 dots sized to the window (dark=%s)', (isDark, fill) => {
    const { ctx, log } = makeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(<InteractiveDotBackground isDark={isDark} />);
    const canvas = container.querySelector('canvas')!;
    expect([canvas.width, canvas.height]).toEqual([900, 500]);
    expect(ctx.arc).toHaveBeenCalledTimes(15);
    expect(log.filter(l => l.startsWith('fill'))).toEqual(Array(15).fill(`fill ${fill}`));
    expect(log.filter(l => l === 'stroke 0.5')).toHaveLength(105);
    expect(frames).toHaveLength(1);
  });

  it('draws mouse lines near the cursor, pauses while hidden and cleans up', () => {
    const { ctx, log } = makeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<InteractiveDotBackground />);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 450, clientY: 250 }));
    for (let i = 0; i < 40; i++) frames.shift()!(0);
    expect(log.some(l => l === 'stroke 1')).toBe(true);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    const arcs = ctx.arc.mock.calls.length;
    frames.shift()!(0);
    expect(ctx.arc.mock.calls.length).toBe(arcs);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    expect(add.mock.calls.map(c => c[0])).toEqual(expect.arrayContaining(['resize', 'mousemove', 'mouseleave']));
    unmount();
    expect(remove.mock.calls.map(c => c[0])).toEqual(expect.arrayContaining(['resize', 'mousemove', 'mouseleave']));
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
