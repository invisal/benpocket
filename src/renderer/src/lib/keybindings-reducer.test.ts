import { describe, expect, it } from 'vitest';
import { withBinding, withoutBinding } from './keybindings-reducer';

describe('withBinding', () => {
  it('adds a binding for a previously-unbound action', () => {
    expect(withBinding([], 'a', 'CommandOrControl+Shift+R')).toEqual([
      { actionId: 'a', accelerator: 'CommandOrControl+Shift+R' }
    ]);
  });

  it('replaces an action’s own previous accelerator', () => {
    const bindings = [{ actionId: 'a', accelerator: 'CommandOrControl+Shift+R' }];
    expect(withBinding(bindings, 'a', 'CommandOrControl+Shift+P')).toEqual([
      { actionId: 'a', accelerator: 'CommandOrControl+Shift+P' }
    ]);
  });

  it('unbinds another action that already held the accelerator', () => {
    const bindings = [{ actionId: 'a', accelerator: 'CommandOrControl+Shift+R' }];
    expect(withBinding(bindings, 'b', 'CommandOrControl+Shift+R')).toEqual([
      { actionId: 'b', accelerator: 'CommandOrControl+Shift+R' }
    ]);
  });

  it('leaves unrelated bindings untouched', () => {
    const bindings = [
      { actionId: 'a', accelerator: 'CommandOrControl+Shift+R' },
      { actionId: 'b', accelerator: 'CommandOrControl+Shift+P' }
    ];
    expect(withBinding(bindings, 'c', 'CommandOrControl+Shift+W')).toEqual([
      { actionId: 'a', accelerator: 'CommandOrControl+Shift+R' },
      { actionId: 'b', accelerator: 'CommandOrControl+Shift+P' },
      { actionId: 'c', accelerator: 'CommandOrControl+Shift+W' }
    ]);
  });
});

describe('withoutBinding', () => {
  it('removes the matching action and leaves the rest', () => {
    const bindings = [
      { actionId: 'a', accelerator: 'CommandOrControl+Shift+R' },
      { actionId: 'b', accelerator: 'CommandOrControl+Shift+P' }
    ];
    expect(withoutBinding(bindings, 'a')).toEqual([
      { actionId: 'b', accelerator: 'CommandOrControl+Shift+P' }
    ]);
  });

  it('is a no-op when the action has no binding', () => {
    const bindings = [{ actionId: 'a', accelerator: 'CommandOrControl+Shift+R' }];
    expect(withoutBinding(bindings, 'z')).toEqual(bindings);
  });
});
