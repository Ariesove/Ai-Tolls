declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;

  export type QueryResult<T extends QueryResultRow = QueryResultRow> = {
    rows: T[];
  };

  export type PoolConfig = {
    connectionString: string;
  };

  export class Pool {
    constructor(config: PoolConfig);
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: ReadonlyArray<unknown>,
    ): Promise<QueryResult<T>>;
  }
}

