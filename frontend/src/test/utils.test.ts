import { describe, it, expect } from 'vitest';

describe('Utility Functions', () => {
  it('basic math works', () => {
    expect(1 + 1).toBe(2);
  });

  it('string concatenation works', () => {
    const str1 = 'Hello';
    const str2 = 'World';
    expect(str1 + ' ' + str2).toBe('Hello World');
  });

  it('array operations work', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr).toContain(2);
  });

  it('object properties work', () => {
    const obj = { name: 'Test', value: 123 };
    expect(obj.name).toBe('Test');
    expect(obj.value).toBe(123);
  });
});
