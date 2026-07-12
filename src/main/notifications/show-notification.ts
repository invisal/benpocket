import { Notification } from 'electron';

export function showNativeNotification(title: string, body: string): boolean {
  if (!Notification.isSupported()) return false;

  const notification = new Notification({ title, body });
  notification.show();
  return true;
}
