const APP_TITLE = 'CraftBox';

function notify(body: string): void {
  void window.api.showNotification(APP_TITLE, body);
}

export function notifySuccess(body: string): void {
  notify(body);
}

export function notifyError(body: string): void {
  notify(body);
}
