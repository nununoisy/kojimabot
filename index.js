const Discord = require('discord.js');
const client = new Discord.Client();
const { Client: pgClient } = require('pg');

const kojimaizer = require('./kojimaizer');

const pgclient = new pgClient({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pgclient.connect();

let guilds = [];

client.once('ready', () => {
    client.user.setActivity("Hi Sponge Bob"); 
    console.log('Login success');
});

let sentThisMinute = false;

setInterval(()=>{
    console.log(`Sending messages to ${guilds.length} guilds`);
    guilds.forEach((guild, idx) => {
        if (guild.destChannel && guild.lastUsername) {
            if (typeof guild.destChannel === 'string') {
                console.log(`Resolving channel ${guild.destChannel} for guild ${guild.id}`);
                client.guilds.fetch(guild.id).then(guildobj=>{
                    guilds[idx].destChannel = guildobj.channels.resolve(guild.destChannel);
                    guild.destChannel.send(kojimaizer(guild.lastUsername));
                });
            } else {
                guild.destChannel.send(kojimaizer(guild.lastUsername));
            }
        }
    });
}, 15 * 60000);

client.on('message', message=>{
    if (!message.guild) return;
    let guildObjIdx = guilds.findIndex(guild=>guild.id===message.guild.id);
    if (guildObjIdx === -1) {
        guildObjIdx = guilds.length;
        guilds.push({
            id: message.guild.id,
            destChannel: null,
            lastUsername: null
        });
        pgclient.query(`INSERT INTO guilds (gid, cid) VALUES ('${message.guild.id}','0');`);
    }
    let perms = new Discord.Permissions(message.channel.permissionsFor(message.guild.me).bitfield);
    if (message.mentions.has(message.guild.me) && message.member.permissions.has('MANAGE_GUILD', true)) {
        if (perms.has('SEND_MESSAGES')) {
            console.log(`Set channel for ${guilds[guildObjIdx].id} to ${message.channel.id}`);
            guilds[guildObjIdx].destChannel = message.channel;
            message.channel.send('Hi Ad Min\n\nI Set The Current Channel To This One');
            pgclient.query(`UPDATE guilds SET cid='${message.channel.id}' WHERE gid='${guilds[guildObjIdx].id}';`);
        } else {
            message.author.send(`Hi Ad Min\n\nI Can't Send Messages In #${message.channel.name} So I Did Not Change The Channel`);
        }
        return;
    }
    if (message.member.id === message.guild.me.id) return;
    guilds[guildObjIdx].lastUsername = message.author.username;
    console.log(guilds[guildObjIdx].lastUsername);
});

console.log('Querying postgresql db');
pgclient.query('SELECT * FROM guilds;', (err, res)=>{
    if (err) throw err;
    console.log('Responded with row count', res.rows.length);
    for (let row of res.rows) {
        console.log(row);
        guilds.push({
            id: row.gid,
            destChannel: row.cid,
            lastUsername: null
        });
    }
    console.log('Logging into discord');
    client.login(process.env.BOTTOKEN);
});