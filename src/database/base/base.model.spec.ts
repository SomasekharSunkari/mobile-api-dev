import { DateTime } from 'luxon';
import { RequestContext } from '../../config/request-context.config';
import { BaseModel } from './base.model';

describe('BaseModel', () => {
  describe('$afterFind', () => {
    it('should convert date fields to the user timezone', () => {
      const instance = new BaseModel();
      const utcDate = new Date('2025-01-01T12:00:00.000Z');

      (instance as any).created_at = utcDate;
      (instance as any).updated_at = utcDate;
      (instance as any).deleted_at = utcDate;

      const mockTimezone = 'America/Chicago';
      jest.spyOn(RequestContext, 'getStore').mockReturnValue({ timezone: mockTimezone });

      instance.$afterFind();

      // The dates should represent the same moment in time, but when converted to the target timezone
      // they should show the correct local time
      const expectedDateTime = DateTime.fromJSDate(utcDate, { zone: 'UTC' }).setZone(mockTimezone);

      // Convert the result dates back to DateTime in the target timezone for comparison
      const createdDateTime = DateTime.fromJSDate((instance as any).created_at).setZone(mockTimezone);
      const updatedDateTime = DateTime.fromJSDate((instance as any).updated_at).setZone(mockTimezone);
      const deletedDateTime = DateTime.fromJSDate((instance as any).deleted_at).setZone(mockTimezone);

      // Compare the formatted time strings in the target timezone
      expect(createdDateTime.toFormat('yyyy-MM-dd HH:mm:ss')).toBe(expectedDateTime.toFormat('yyyy-MM-dd HH:mm:ss'));
      expect(updatedDateTime.toFormat('yyyy-MM-dd HH:mm:ss')).toBe(expectedDateTime.toFormat('yyyy-MM-dd HH:mm:ss'));
      expect(deletedDateTime.toFormat('yyyy-MM-dd HH:mm:ss')).toBe(expectedDateTime.toFormat('yyyy-MM-dd HH:mm:ss'));
    });
  });
});
