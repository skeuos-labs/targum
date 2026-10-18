import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../src/App';

describe('App', () => {
  it('renders desktop shell header', () => {
    render(<App />);
    expect(screen.getByText('Show Converter')).toBeDefined();
  });
});
