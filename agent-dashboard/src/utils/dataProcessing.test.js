import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { tryParseDate, getProjectOptions, computeTimeseriesForProject } from './dataProcessing';

describe('dataProcessing', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('tryParseDate', () => {
        it('parses ISO date string', () => {
            const d = tryParseDate('2023-01-01T00:00:00Z');
            expect(d).toBeInstanceOf(Date);
            expect(d.toISOString()).toContain('2023-01-01');
        });

        it('parses numeric timestamp (millis)', () => {
            const now = 1672531200000; // 2023-01-01
            const d = tryParseDate(now);
            expect(d).toBeInstanceOf(Date);
            expect(d.getTime()).toBe(now);
        });

        it('returns null for invalid date', () => {
            expect(tryParseDate('invalid')).toBeNull();
        });
    });

    describe('getProjectOptions', () => {
        it('extracts unique project IDs', () => {
            const rows = [
                { project_id: 'A' },
                { project_id: 'B' },
                { project_id: 'A' },
            ];
            const options = getProjectOptions(rows);
            expect(options).toEqual(['A', 'B']);
        });
    });

    describe('computeTimeseriesForProject', () => {
        it('aggregates costs correctly', () => {
            // Set system time to 2023-01-02T12:00:00Z
            const mockDate = new Date('2023-01-02T12:00:00Z');
            vi.setSystemTime(mockDate);

            const todayStr = '2023-01-02';
            const yesterdayStr = '2023-01-01';

            const rows = [
                { project_id: 'A', usage_start_time: todayStr, cost: '10' },
                { project_id: 'A', usage_start_time: todayStr, cost: '5' },
                { project_id: 'A', usage_start_time: yesterdayStr, cost: '20' },
                { project_id: 'B', usage_start_time: todayStr, cost: '100' },
            ];

            const result = computeTimeseriesForProject(rows, 'project_id', 'usage_start_time', 'cost', 'A', 7);

            expect(result.series).toBeDefined();

            const todayEntry = result.series.find(s => s.x === todayStr);
            const yesterdayEntry = result.series.find(s => s.x === yesterdayStr);

            expect(todayEntry).toBeDefined();
            expect(yesterdayEntry).toBeDefined();
            expect(todayEntry.y).toBe(15);
            expect(yesterdayEntry.y).toBe(20);
        });
    });
});
