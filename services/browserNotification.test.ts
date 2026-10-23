import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestNotificationPermission, notifyWhenHidden } from './browserNotification';

const stubNotification = (permission: string) => {
  const shown: any[] = [];
  const N: any = vi.fn(function (this: any, title: string, opts: any) { shown.push({ title, ...opts }); });
  N.permission = permission;
  N.requestPermission = vi.fn(async () => 'granted');
  vi.stubGlobal('Notification', N);
  return { N, shown };
};
const setHidden = (hidden: boolean) => Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });

afterEach(() => { vi.unstubAllGlobals(); setHidden(false); });

describe('browser notifications', () => {
  it('asks for permission only when the user has not decided yet', () => {
    const { N } = stubNotification('default');
    requestNotificationPermission();
    expect(N.requestPermission).toHaveBeenCalledTimes(1);
    N.permission = 'denied';
    requestNotificationPermission();
    expect(N.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('notifies only while the app is hidden and permission is granted', () => {
    const { N, shown } = stubNotification('granted');
    notifyWhenHidden('LI CELL Studio', 'done');
    expect(shown).toEqual([]);
    setHidden(true);
    notifyWhenHidden('LI CELL Studio', 'done');
    expect(shown).toEqual([{ title: 'LI CELL Studio', body: 'done', icon: '/pwa-192x192.png', tag: 'transcriver-batch' }]);
    N.permission = 'denied';
    notifyWhenHidden('LI CELL Studio', 'again');
    expect(shown).toHaveLength(1);
  });

  it('does nothing where notifications are not supported or throw', () => {
    vi.stubGlobal('Notification', undefined);
    delete (window as any).Notification;
    setHidden(true);
    expect(() => { requestNotificationPermission(); notifyWhenHidden('t', 'b'); }).not.toThrow();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const N: any = function () { throw new TypeError('Illegal constructor'); };
    N.permission = 'granted';
    vi.stubGlobal('Notification', N);
    notifyWhenHidden('t', 'b');
    expect(warn).toHaveBeenCalled();
  });
});
