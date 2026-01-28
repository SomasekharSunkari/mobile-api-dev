import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database/base';
import { TransactionModel } from '../../database/models';
import { IActivityFilters, IActivityPaginatedResponse } from './activity.interface';
import { getUserActivitiesQuery } from '../../queries/activities';

@Injectable()
export class ActivityRepository extends BaseRepository<TransactionModel> {
  /**
   * We extend BaseRepository<TransactionModel> to access the database connection through this.model.knex().
   * This follows the project pattern instead of injecting the database connection directly,
   * maintaining consistency with other repository classes and leveraging the BaseRepository infrastructure.
   */
  constructor() {
    super(TransactionModel);
  }

  async getUserActivities(userId: string, filters: IActivityFilters = {}): Promise<IActivityPaginatedResponse> {
    const { activity_type, start_date, end_date, page, limit } = filters;
    const actualPage = page || 1;
    const actualLimit = limit || 10;

    // Use the activity list query
    const baseSQL = getUserActivitiesQuery();
    const bindings = [userId, userId, userId, userId, userId];
    const whereConditions = [];

    // Apply filters
    if (activity_type) {
      if (Array.isArray(activity_type)) {
        // Handle multiple activity types with IN clause
        const placeholders = activity_type.map(() => '?').join(', ');
        whereConditions.push(`activity_type IN (${placeholders})`);
        bindings.push(...activity_type);
      } else {
        // Handle single activity type
        whereConditions.push('activity_type = ?');
        bindings.push(activity_type);
      }
    }

    if (start_date) {
      whereConditions.push('activity_date >= ?');
      bindings.push(start_date);
    }

    if (end_date) {
      whereConditions.push('activity_date <= ?');
      bindings.push(end_date);
    }

    // Build final query with filters and window function for count
    let finalSQL = `
      SELECT *, COUNT(*) OVER() as total_count 
      FROM (${baseSQL}) as activities
    `;
    if (whereConditions.length > 0) {
      finalSQL += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    finalSQL += ' ORDER BY activity_date DESC';

    // Apply pagination
    const offset = (actualPage - 1) * actualLimit;
    finalSQL += ' LIMIT ? OFFSET ?';
    const paginatedBindings = [...bindings, actualLimit, offset];

    const result = await this.model.knex().raw(finalSQL, paginatedBindings);
    const activities = result.rows;

    // Extract total from first row (all rows have same total_count due to window function)
    const total = activities.length > 0 ? Number.parseInt(activities[0].total_count) : 0;
    const pageCount = Math.ceil(total / actualLimit);

    // Remove total_count from each activity object
    const cleanActivities = activities.map((activity) => {
      delete activity.total_count;
      return activity;
    });

    return {
      activities: cleanActivities,
      pagination: {
        previous_page: actualPage > 1 ? actualPage - 1 : 0,
        current_page: actualPage,
        next_page: actualPage < pageCount ? actualPage + 1 : 0,
        limit: actualLimit,
        page_count: pageCount,
        total,
      },
    };
  }
}
