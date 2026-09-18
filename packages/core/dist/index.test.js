import { describe, expect, it } from 'vitest';
import { SENTINEL_CORE_VERSION } from './index.js';
describe('@sentinel/core', () => {
    it('exposes a version marker', () => {
        expect(SENTINEL_CORE_VERSION).toBe('0.1.0');
    });
});
