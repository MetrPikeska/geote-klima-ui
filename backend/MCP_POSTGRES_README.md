# MCP PostgreSQL Server

MCP (Model Context Protocol) server pro komunikaci s PostgreSQL databází.

## Funkčnosti

Dostupné nástroje:
- **execute_query** - Spustit vlastní SQL dotaz
- **get_tables** - Vypsat všechny tabulky
- **get_table_schema** - Získat schéma tabulky
- **get_table_data** - Čtení dat z tabulky (s paginací)
- **insert_record** - Vložit záznam
- **update_record** - Aktualizovat záznam
- **delete_record** - Smazat záznam
- **database_stats** - Statistiky databáze

## Spuštění

```bash
node mcp-postgres-server.js
```

MCP server komunikuje přes stdin/stdout s JSON formátem.

## Konfigurace

Server používá stejné `.env` proměnné jako Express backend:
- `DB_HOST` - Adresa PostgreSQL serveru
- `DB_PORT` - Port (default: 5432)
- `DB_USER` - Uživatelské jméno
- `DB_PASSWORD` - Heslo
- `DB_NAME` - Jméno databáze

## Příklady použití

### Spuštění dotazu

```json
{
  "method": "tools/call",
  "params": {
    "name": "execute_query",
    "arguments": {
      "sql": "SELECT * FROM climate_results_cache LIMIT 5",
      "params": []
    }
  }
}
```

### Čtení tabulky

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_table_data",
    "arguments": {
      "table_name": "climate_results_cache",
      "limit": 10,
      "offset": 0
    }
  }
}
```

### Vložení záznamu

```json
{
  "method": "tools/call",
  "params": {
    "name": "insert_record",
    "arguments": {
      "table_name": "climate_results_cache",
      "data": {
        "geometry_hash": "abc123",
        "result": "{...}"
      }
    }
  }
}
```

## Integrace s Claude

Server je kompatibilní s Claude MCP. Přidejte do vaší Claude konfigurace:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["path/to/mcp-postgres-server.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_USER": "postgres",
        "DB_NAME": "klima"
      }
    }
  }
}
```

Pak v Claude můžete používat `@postgres` pro přístup k databázi.
