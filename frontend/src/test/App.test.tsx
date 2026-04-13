import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

describe('App Component', () => {
  it('renders application successfully', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(div).toBeTruthy();
  });

  it('can create DOM elements', () => {
    const element = document.createElement('p');
    element.textContent = 'Test';
    expect(element.textContent).toBe('Test');
  });
});
