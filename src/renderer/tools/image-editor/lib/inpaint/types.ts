export interface RunInpaintMessage {
  type: 'run';
  rgba: ArrayBuffer;
  width: number;
  height: number;
  /** 0 = known pixel, non-zero = hole (needs to be synthesized). */
  mask: ArrayBuffer;
}

export interface CancelInpaintMessage {
  type: 'cancel';
}

export type InpaintInMessage = RunInpaintMessage | CancelInpaintMessage;

export interface ProgressOutMessage {
  type: 'progress';
  done: number;
  total: number;
}

export interface ResultOutMessage {
  type: 'result';
  rgba: ArrayBuffer;
  width: number;
  height: number;
}

export interface CancelledOutMessage {
  type: 'cancelled';
}

export interface ErrorOutMessage {
  type: 'error';
  message: string;
}

export type InpaintOutMessage =
  ProgressOutMessage | ResultOutMessage | CancelledOutMessage | ErrorOutMessage;
