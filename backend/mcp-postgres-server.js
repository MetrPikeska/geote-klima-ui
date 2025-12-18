#!/usr/bin/env node
/**
 * MCP PostgreSQL Server
 * Exposes PostgreSQL database as MCP resources and tools
 */

const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// ============================================================
//   MCP Server Implementation
// ============================================================

class PostgreSQLMCPServer {
  constructor() {
    this.pool = null;
    this.initializePool();
  }

  initializePool() {
    const dbPassword = process.env.DB_PASSWORD;
    if (!dbPassword || typeof dbPassword !== "string") {
      console.error("❌ DB_PASSWORD is not set or is not a string!");
      process.exit(1);
    }

    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "postgres",
      password: dbPassword,
      database: process.env.DB_NAME || "klima",
      port: parseInt(process.env.DB_PORT || "5432", 10),
    });

    this.pool.on("error", (err) => {
      console.error("✗ Unexpected database error:", err);
    });
  }

  /**
   * Tool: Execute SQL query
   */
  async executeQuery(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return {
        success: true,
        rowCount: result.rowCount,
        rows: result.rows,
        fields: result.fields?.map((f) => f.name) || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  /**
   * Tool: Get table schema
   */
  async getTableSchema(tableName) {
    try {
      const query = `
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `;
      const result = await this.pool.query(query, [tableName]);
      return {
        success: true,
        table: tableName,
        columns: result.rows,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tool: List all tables
   */
  async listTables() {
    try {
      const query = `
        SELECT 
          table_name,
          (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      const result = await this.pool.query(query);
      return {
        success: true,
        tables: result.rows,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tool: Get table data with pagination
   */
  async getTableData(tableName, limit = 100, offset = 0) {
    try {
      // Get total count
      const countResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM ${tableName}`
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);

      // Get data
      const dataResult = await this.pool.query(
        `SELECT * FROM ${tableName} LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return {
        success: true,
        table: tableName,
        totalCount,
        limit,
        offset,
        rowCount: dataResult.rowCount,
        rows: dataResult.rows,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tool: Execute insert
   */
  async insertRecord(tableName, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = columns
        .map((_, i) => `$${i + 1}`)
        .join(", ");

      const query = `
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return {
        success: true,
        inserted: result.rows[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tool: Execute update
   */
  async updateRecord(tableName, id, data) {
    try {
      const columns = Object.keys(data);
      const values = Object.values(data);

      const setClause = columns
        .map((col, i) => `${col} = $${i + 1}`)
        .join(", ");

      const query = `
        UPDATE ${tableName}
        SET ${setClause}
        WHERE id = $${columns.length + 1}
        RETURNING *
      `;

      const result = await this.pool.query(query, [...values, id]);
      return {
        success: true,
        updated: result.rows[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tool: Delete record
   */
  async deleteRecord(tableName, id) {
    try {
      const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`;
      const result = await this.pool.query(query, [id]);
      return {
        success: true,
        deleted: result.rows[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Tool: Get database statistics
   */
  async getDatabaseStats() {
    try {
      const result = await this.pool.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);
      return {
        success: true,
        stats: result.rows,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Main MCP handler
   */
  async handleRequest(request) {
    const { method, params } = request;

    console.log(`[MCP] Received: ${method}`, params);

    try {
      switch (method) {
        // Resource: list available tables
        case "resources/list": {
          const tables = await this.listTables();
          return {
            resources: tables.tables.map((t) => ({
              uri: `postgres://table/${t.table_name}`,
              name: t.table_name,
              description: `Table ${t.table_name} (${t.column_count} columns)`,
              mimeType: "application/json",
            })),
          };
        }

        // Resource: read table schema
        case "resources/read": {
          const uri = params.uri;
          if (uri.startsWith("postgres://table/")) {
            const tableName = uri.replace("postgres://table/", "");
            const schema = await this.getTableSchema(tableName);
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(schema, null, 2),
                },
              ],
            };
          }
          break;
        }

        // Tool: query
        case "tools/call": {
          const { name, arguments: args } = params;

          switch (name) {
            case "execute_query":
              return await this.executeQuery(args.sql, args.params);

            case "get_tables":
              return await this.listTables();

            case "get_table_schema":
              return await this.getTableSchema(args.table_name);

            case "get_table_data":
              return await this.getTableData(
                args.table_name,
                args.limit || 100,
                args.offset || 0
              );

            case "insert_record":
              return await this.insertRecord(args.table_name, args.data);

            case "update_record":
              return await this.updateRecord(
                args.table_name,
                args.id,
                args.data
              );

            case "delete_record":
              return await this.deleteRecord(args.table_name, args.id);

            case "database_stats":
              return await this.getDatabaseStats();

            default:
              return { error: `Unknown tool: ${name}` };
          }
        }

        default:
          return { error: `Unknown method: ${method}` };
      }
    } catch (error) {
      console.error("[MCP] Error:", error);
      return { error: error.message };
    }
  }

  async close() {
    await this.pool.end();
  }
}

// ============================================================
//   Server Instance & STDIO Protocol
// ============================================================

const server = new PostgreSQLMCPServer();

// Handle stdin/stdout for MCP communication
process.stdin.setEncoding("utf8");

let buffer = "";

process.stdin.on("data", async (chunk) => {
  buffer += chunk;

  // Try to parse complete JSON objects
  const lines = buffer.split("\n");
  buffer = lines[lines.length - 1]; // Keep incomplete line in buffer

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const request = JSON.parse(line);
        const response = await server.handleRequest(request);
        console.log(JSON.stringify(response));
      } catch (error) {
        console.error(
          JSON.stringify({
            error: error.message,
          })
        );
      }
    }
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("[MCP] Shutting down...");
  await server.close();
  process.exit(0);
});

console.error("[MCP] PostgreSQL MCP Server started");
