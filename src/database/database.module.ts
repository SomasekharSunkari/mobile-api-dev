import { Global, Module } from '@nestjs/common';
import { Model } from 'objection';
import { KnexDB } from './database.connection';
import { DATABASE_TOKEN } from './database.token';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN.knexConfigToken,
      useFactory: () => {
        const knex = KnexDB.connection();

        // Attach knex to Objection Model
        Model.knex(knex);

        // return the connection
        return knex;
      },
    },
  ],
})
export class DatabaseModule {}
