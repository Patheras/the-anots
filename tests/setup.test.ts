/**
 * Setup verification test
 * Ensures the testing framework is properly configured
 */

describe('Project Setup', () => {
  it('should have Jest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript', () => {
    const version: string = '1.0.0';
    expect(typeof version).toBe('string');
  });

  it('should have fast-check available', async () => {
    const fc = await import('fast-check');
    expect(fc).toBeDefined();
  });

  it('should have zod available', async () => {
    const { z } = await import('zod');
    expect(z).toBeDefined();
  });
});
