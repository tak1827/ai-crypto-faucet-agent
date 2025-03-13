# ai-crypto-faucet-agent
A generative AI agent primarily used for crypto faucet airdrops, distributing crypto to enthusiastic users. Additionally, it can promote or support projects.

# Getting Started
## Setting Up the Database
```sh
# Install PostgreSQL and pgvector extension
brew install postgresql@17 pgvector

# Start PostgreSQL service
brew services start postgresql@17

# Create a PostgreSQL superuser
createuser -s postgres

# Create a new database named 'aifaucet'
createdb -E UTF8 aifaucet
# dropdb aifaucet

# Connect to the newly created database
psql aifaucet
```

Enable Vector Extension and Set User Password
Once connected to psql, run the following SQL commands:
```sql
-- Enable the pgvector extension
CREATE EXTENSION vector;

-- Set a password for the 'postgres' user
ALTER USER postgres WITH PASSWORD '123456';
```