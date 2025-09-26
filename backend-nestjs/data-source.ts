import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AccountNotebook } from './src/account-notebook/account-notebook.entity';
import { UserNotebookSubscription } from './src/account-notebook/user-notebook-subscription.entity';

config();

// Definimos los parametros de conexion con prioridad clara para soportar multiples despliegues.
const databaseUrl = process.env.DATABASE_URL;

const baseConnection: DataSourceOptions = databaseUrl
  ? {
      type: 'postgres',
      url: databaseUrl,
    }
  : {
      type: 'postgres',
      host: process.env.PGHOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'poc_concurrency',
      username: process.env.PGUSER ?? 'postgres',
      password: process.env.PGPASSWORD ?? 'postgres',
    };

export const dataSourceOptions: DataSourceOptions = {
  ...baseConnection,
  entities: [AccountNotebook, UserNotebookSubscription],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
};

const appDataSource = new DataSource(dataSourceOptions);

export default appDataSource;
