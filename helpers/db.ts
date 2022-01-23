import { Client } from 'pg';
import type { Snowflake, TextChannel } from 'discord.js';

const q = (parts: TemplateStringsArray, ...values: any[]): [string, any[]] => {
    let query = '';
    for (let i = 0; i < parts.length; ++i) {
        if (i > 0)
            query += `$${i}`;
        query += parts[i];
    }
    query = query.replace(/[\s\n]+/gu, ' ').trim();
    return [query, values];
}

export interface GuildInfo {
    gid: Snowflake, // Guild ID
    cid?: Snowflake, // Destination channel ID
    enterMessage: boolean, // Join messages enabled
    leaveMessage: boolean, // Leave messages enabled
    greetInterval: number, // Minutes between random greetings (0 to disable)
    greetedLast: Date, // Last greeting time
    jpEnabled: boolean, // Japanese mode enabled
    destChannel?: TextChannel, // Destination channel object
    lastUsername?: string | null, // Last username who spoke in the channel,
    repeatGreet: boolean // Repeat greeting if no new users have spoken since the last greeting
}

export default class DBHelper {
    pgClient: Client;
    lastUsernames: Map<Snowflake, string>;

    /**
     * Create DBHelper and connect to pg db.
     */
    constructor () {
        const connectionString = process.env.DATABASE_URL;

        this.lastUsernames = new Map<Snowflake, string>();

        this.pgClient = new Client({
            connectionString,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }

    /**
     * Connect to the database.
     */
    async connect () {
        this.pgClient.on('error', (err) => {
            console.error('Postgres error:', err);
        });
        await this.pgClient.connect();
    }

    /**
     * Prepare the database by creating tables if necessary.
     */
    async prepareDatabase() {
        await this.pgClient.query(...q`
        CREATE TABLE IF NOT EXISTS guilds (
            gid varchar(20) PRIMARY KEY NOT NULL,
            cid varchar(20) NULL,
            entermsg boolean DEFAULT false NULL,
            leavemsg boolean DEFAULT false NULL,
            greetinterval integer DEFAULT 15 NULL,
            greetedlast timestamp without time zone DEFAULT NOW() NULL,
            jpenabled boolean DEFAULT false NULL,
            repeatgreet boolean DEFAULT true NULL
        );
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS gid varchar(20) PRIMARY KEY NOT NULL;
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS cid varchar(20) NULL;
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS entermsg boolean DEFAULT false NULL;
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS leavemsg boolean DEFAULT false NULL;
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greetinterval integer DEFAULT 15 NULL;
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS greetedlast timestamp without time zone DEFAULT NOW() NULL;
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS jpenabled boolean DEFAULT false NULL;
        ALTER TABLE guilds ADD COLUMN IF NOT EXISTS repeatgreet boolean DEFAULT true NULL;
        CREATE TABLE IF NOT EXISTS votes (
            uid varchar(20) PRIMARY KEY NOT NULL,
            count integer DEFAULT 0 NOT NULL
        );
        ALTER TABLE votes ADD COLUMN IF NOT EXISTS uid varchar(20) PRIMARY KEY NOT NULL;
        ALTER TABLE votes ADD COLUMN IF NOT EXISTS count integer DEFAULT 0 NOT NULL;
        `);
    }

    /**
     * Add new guild to database.
     * @param gid Guild ID
     */
    async addNewGuild(gid: Snowflake) {
        await this.pgClient.query(...q`
        INSERT INTO guilds (gid, cid)
        VALUES (${gid},${'0'});
        `)
    }

    /**
     * Update guild in database
     * @param guildInfo Guild info
     */
    async updateGuild(guildInfo: GuildInfo) {
        await this.pgClient.query(...q`
        UPDATE guilds
        SET
            cid = ${guildInfo.cid},
            entermsg = ${guildInfo.enterMessage},
            leavemsg = ${guildInfo.leaveMessage},
            greetinterval = ${guildInfo.greetInterval},
            greetedlast = ${guildInfo.greetedLast},
            jpenabled = ${guildInfo.jpEnabled},
            repeatgreet = ${guildInfo.repeatGreet}
        WHERE gid = ${guildInfo.gid};
        `);
        if (guildInfo.lastUsername) {
            this.lastUsernames.set(guildInfo.gid, guildInfo.lastUsername);
        } else {
            this.lastUsernames.delete(guildInfo.gid);
        }
    }

    /**
     * Get guild info from database.
     * @param gid Guild ID
     */
    async getGuildInfo(gid: Snowflake): Promise<GuildInfo | null> {
        const res = await this.pgClient.query(...q`
        SELECT * FROM guilds
        WHERE gid = ${gid};
        `);
        if (res.rows.length === 0)
            return null;
        const row = res.rows[0];
        const lastUsername = this.lastUsernames.get(gid) ?? undefined;
        return {
            gid: row.gid,
            cid: row.cid,
            enterMessage: row.entermsg,
            leaveMessage: row.leavemsg,
            greetInterval: row.greetinterval,
            greetedLast: row.greetedlast,
            jpEnabled: row.jpenabled,
            repeatGreet: row.repeatgreet,
            lastUsername
        };
    }

    /**
     * Get credit balance for a user.
     * @param uid User ID
     */
    async getUserCreditBalance(uid: Snowflake) {
        const result = await this.pgClient.query(...q`
        SELECT count FROM votes
        WHERE uid = ${uid};
        `);

        return result.rows[0]?.count ?? 0;
    }

    /**
     * Consume credits from a user's balance.
     * @param uid User ID.
     * @param currentBalance Current balance from getUserCreditBalance().
     * @param amount Number of credits to consume.
     */
    async useCredits(uid: Snowflake, currentBalance: number, amount: number) {
        if (currentBalance < amount)
            throw new Error("Not enough credits");

        await this.pgClient.query(...q`
        UPDATE votes
        SET count = ${currentBalance - (amount || 1)}
        WHERE uid = ${uid};
        `);
    }

    /**
     * Add credits to a user's balance, or add the user to the list if they don't already exist.
     * @param uid User ID.
     * @param count Number of credits to add.
     */
    async giveCredits(uid: Snowflake, count: number) {
        await this.pgClient.query(...q`
        INSERT INTO votes (uid, count)
        VALUES (${uid}, ${count})
        ON CONFLICT (uid) DO
            UPDATE SET count = excluded.count + votes.count;
        `);
    }
}