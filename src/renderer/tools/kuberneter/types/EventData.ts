export interface EventData {
  id: string;
  type: 'Normal' | 'Warning' | string;
  source: string;
  ns: string;
  involvedObject: string;
  involvedKind: string;
  message: string;
  count: number;
  age: string;
  lastSeen: string;
  rawLastSeen: number;
}
