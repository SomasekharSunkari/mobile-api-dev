import { EnvironmentService } from './src/config/environment/index';
import { DB } from './src/constants/db';
import { ConfigObject, Connection } from './src/database';
class KnexFile {
  private static getConnection(): Connection {
    const { db_host, db_password, db_user, db_name, db_port, db_ssl } = EnvironmentService.getValues();

    const dbConnection: Connection = {
      host: db_host,
      user: db_user,
      password: db_password,
      database: db_name,
      port: db_port,
    };

    if (db_ssl) {
      dbConnection.ssl = {
        rejectUnauthorized: false,
      };
    }

    return dbConnection;
  }

  private static getConfig(): ConfigObject {
    return {
      client: DB.driver,
      connection: KnexFile.getConnection(),
      pool: {
        min: 0,
        max: 10,
      },
      migrations: {
        directory: DB.migrationDirectory,
        tableName: DB.tableName,
        extension: 'ts',
      },
      seeds: {
        directory: DB.seedDirectory,
        extension: 'ts',
      },
    };
  }

  public static getConfigEnvironments(): ConfigObject {
    const config = KnexFile.getConfig();
    const { node_env: nodeEnv } = EnvironmentService.getValues();

    return {
      development: config,

      staging: config,

      production: config,

      test: { ...config, debug: true },
    }[nodeEnv];
  }
}

module.exports = KnexFile.getConfigEnvironments();
