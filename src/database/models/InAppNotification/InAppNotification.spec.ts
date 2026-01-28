import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IInAppNotification } from './InAppNotification.interface';
import { InAppNotificationModel } from './InAppNotification.model';
import { InAppNotificationValidationSchema } from './InAppNotification.validation';

jest.mock('../../base');

describe('InAppNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Interface Tests
  describe('IInAppNotification', () => {
    it('should have the correct required fields and types', () => {
      const notification: IInAppNotification = {
        id: 'notif1',
        user_id: 'user1',
        type: 'info',
        title: 'Test Title',
        message: 'Test message',
        is_read: false,
        created_at: new Date(),
        updated_at: new Date(),
        metadata: { foo: 'bar' },
      };
      expect(notification.user_id).toBe('user1');
      expect(notification.type).toBe('info');
      expect(notification.title).toBe('Test Title');
      expect(notification.message).toBe('Test message');
      expect(notification.is_read).toBe(false);
      expect(notification.metadata).toEqual({ foo: 'bar' });
    });
  });

  // Validation Schema Tests
  describe('InAppNotificationValidationSchema', () => {
    it('should have the correct title', () => {
      expect(InAppNotificationValidationSchema.title).toBe('InAppNotification Validation Schema');
    });
    it('should be of type object', () => {
      expect(InAppNotificationValidationSchema.type).toBe('object');
    });
    it('should require specific fields', () => {
      const requiredFields = InAppNotificationValidationSchema.required;
      expect(requiredFields).toContain('user_id');
      expect(requiredFields).toContain('type');
      expect(requiredFields).toContain('title');
      expect(requiredFields).toContain('message');
      expect(requiredFields).not.toContain('is_read');
    });
    describe('properties', () => {
      const properties = InAppNotificationValidationSchema.properties as Record<string, any>;
      it('should have user_id as string', () => {
        expect(properties.user_id.type).toBe('string');
      });
      it('should have type as string', () => {
        expect(properties.type.type).toBe('string');
      });
      it('should have title as string', () => {
        expect(properties.title.type).toBe('string');
      });
      it('should have message as string', () => {
        expect(properties.message.type).toBe('string');
      });
      it('should have is_read as boolean', () => {
        expect(properties.is_read.type).toBe('boolean');
      });
      it('should have metadata as object', () => {
        expect(properties.metadata.type).toBe('object');
      });
    });
  });

  // Model Tests
  describe('InAppNotificationModel', () => {
    describe('tableName', () => {
      it('should return the correct table name', () => {
        expect(InAppNotificationModel.tableName).toBe(
          `${DatabaseSchema.apiService}.${DatabaseTables.in_app_notifications}`,
        );
      });
    });
    describe('jsonSchema', () => {
      it('should return the notification validation schema', () => {
        expect(InAppNotificationModel.jsonSchema).toBe(InAppNotificationValidationSchema);
      });
    });
    describe('publicProperty', () => {
      it('should return the default public properties', () => {
        const properties = InAppNotificationModel.publicProperty();
        expect(properties).toContain('id');
        expect(properties).toContain('user_id');
        expect(properties).toContain('type');
        expect(properties).toContain('title');
        expect(properties).toContain('message');
        expect(properties).toContain('is_read');
        expect(properties).toContain('metadata');
        expect(properties).toContain('created_at');
        expect(properties).toContain('updated_at');
      });
    });
    describe('relationMappings', () => {
      beforeEach(() => {
        BaseModel.BelongsToOneRelation = 'BelongsToOneRelation' as any;
      });
      it('should define the user relation correctly', () => {
        const relations = InAppNotificationModel.relationMappings;
        expect(relations.user).toBeDefined();
        expect(relations.user.relation).toBe('BelongsToOneRelation');
        expect(relations.user.join).toEqual({
          from: `${DatabaseSchema.apiService}.${DatabaseTables.in_app_notifications}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        });
      });
    });
    describe('modifiers', () => {
      it('should have a notDeleted modifier', () => {
        const modifiers = InAppNotificationModel.modifiers;
        expect(modifiers.notDeleted).toBeDefined();
        expect(typeof modifiers.notDeleted).toBe('function');
        const mockQuery = { whereNull: jest.fn() };
        modifiers.notDeleted(mockQuery as any);
        expect(mockQuery.whereNull).toHaveBeenCalledWith('deleted_at');
      });
    });
    describe('instance properties', () => {
      let inAppNotificationModel: InAppNotificationModel;
      beforeEach(() => {
        inAppNotificationModel = new InAppNotificationModel();
        inAppNotificationModel.user_id = 'user1';
        inAppNotificationModel.type = 'info';
        inAppNotificationModel.title = 'Test Title';
        inAppNotificationModel.message = 'Test message';
        inAppNotificationModel.is_read = false;
        inAppNotificationModel.metadata = { foo: 'bar' };
      });
      it('should properly store the instance properties', () => {
        expect(inAppNotificationModel.user_id).toBe('user1');
        expect(inAppNotificationModel.type).toBe('info');
        expect(inAppNotificationModel.title).toBe('Test Title');
        expect(inAppNotificationModel.message).toBe('Test message');
        expect(inAppNotificationModel.is_read).toBe(false);
        expect(inAppNotificationModel.metadata).toEqual({ foo: 'bar' });
      });
      it('should inherit from BaseModel', () => {
        expect(inAppNotificationModel).toBeInstanceOf(BaseModel);
      });
    });
  });
});
