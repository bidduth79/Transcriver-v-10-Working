import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { useModalBehavior } from './useModalBehavior';

const Modal = ({ active = true, onClose, label }: { active?: boolean; onClose: () => void; label: string }) => {
  const { dialogProps, backdropProps } = useModalBehavior(active, onClose);
  return (
    <div data-testid={`backdrop-${label}`} {...backdropProps}>
      <div {...dialogProps} data-testid={`dialog-${label}`}>
        <button>{label}-first</button>
        <button>{label}-last</button>
      </div>
    </div>
  );
};

const flushFocus = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));

afterEach(cleanup);

describe('useModalBehavior', () => {
  it('marks the dialog, focuses it and closes on Esc', async () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Modal onClose={onClose} label="a" />);
    const dialog = getByTestId('dialog-a');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    await flushFocus();
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the top modal on Esc, and ignores an Esc someone already handled', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(<><Modal onClose={lower} label="a" /><Modal onClose={upper} label="b" /></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    handled.preventDefault();
    document.dispatchEvent(handled);
    expect(upper).toHaveBeenCalledTimes(1);
  });

  it('does nothing while inactive (closed or minimised)', () => {
    const onClose = vi.fn();
    render(<Modal active={false} onClose={onClose} label="a" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps Tab inside the dialog', () => {
    const { getByText } = render(<Modal onClose={vi.fn()} label="a" />);
    getByText('a-last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByText('a-first'));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByText('a-last'));
  });

  it('locks page scroll while open and gives focus back when closed', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = render(<Modal onClose={vi.fn()} label="a" />);
    await flushFocus();
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Modal active={false} onClose={vi.fn()} label="a" />);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('closes on a click on the backdrop, not on one that started inside the dialog', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Modal onClose={onClose} label="a" />);
    const backdrop = getByTestId('backdrop-a');
    fireEvent.mouseDown(getByTestId('dialog-a'));
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('dialog-a'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
