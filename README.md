# kojimabot
Hi Sponge Bob

[Invite me to your server!](https://discord.com/oauth2/authorize?client_id=753757823535677561&scope=bot)

## Setup
You will need to set up a PostgreSQL server, and execute the following query on it:
```sql
CREATE TABLE guilds ( gid varchar(20), cid varchar(20) );
```
Then:
```bash
git clone https://github.com/nununoisy/kojimabot
cd kojimabot
npm i
BOTTOKEN=<xxx> DATABASE_URL=<dburl> node .
```
