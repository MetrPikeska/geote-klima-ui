# Claude Code Configuration

This directory contains configuration for Claude Code (VSCode extension) including MCP (Model Context Protocol) servers.

## MCP Server Configuration

### PostgreSQL Server

The `mcp.json` file configures a PostgreSQL MCP server that allows Claude Code to directly query the `klima` database.

**Setup:**

1. Copy the example file:
   ```bash
   cp mcp.json.example mcp.json
   ```

2. Edit `mcp.json` and set your PostgreSQL password:
   ```json
   {
     "env": {
       "DB_PASSWORD": "your_actual_password"
     }
   }
   ```

3. Restart Claude Code to activate the MCP server

**What you can do with PostgreSQL MCP server:**
- ✅ Explore database schema
- ✅ Run SQL queries directly
- ✅ Analyze data
- ✅ Check indexes and optimize queries
- ✅ Debug PostGIS spatial queries

**Security:**
- ❌ Never commit `mcp.json` to git (it's in .gitignore)
- ✅ Use `mcp.json.example` as a template for others

## How MCP Servers Work

MCP servers act as intermediaries between Claude Code and external services:

```
You → Claude Code → MCP Server → PostgreSQL
```

This allows Claude to:
- Query your database safely
- Provide context-aware suggestions
- Debug SQL queries
- Optimize database performance

## Available MCP Servers

Currently configured:
- **postgres-klima**: PostgreSQL server for the `klima` database

## Troubleshooting

If MCP server doesn't work:
1. Check PostgreSQL is running: `psql -U postgres -d klima -c "SELECT 1;"`
2. Verify credentials in `mcp.json`
3. Check Claude Code logs for MCP errors
4. Restart VSCode

## More Information

- [Claude Code Documentation](https://github.com/anthropics/claude-code)
- [MCP Protocol Specification](https://github.com/modelcontextprotocol)
