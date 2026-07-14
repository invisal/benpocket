import { type FileDriver } from './fileDriver';
import { localFileDriver } from './localFileDriver';
import { r2FileDriver } from './r2FileDriver';
import { parseLocation, type ParsedLocation } from './location';

const drivers: Partial<Record<ParsedLocation['scheme'], FileDriver>> = {
  local: localFileDriver,
  r2: r2FileDriver
};

export function getDriverForLocation(uri: string): FileDriver {
  const { scheme } = parseLocation(uri);
  const driver = drivers[scheme];
  if (!driver) {
    throw new Error(`No file driver registered for scheme "${scheme}"`);
  }
  return driver;
}
