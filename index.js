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

client.on('guildMemberAdd', member => {
    let djsguild = member.guild;
    let guildObjIdx = guilds.findIndex(fguild=>fguild.id===djsguild.id);
    if (guildObjIdx === -1 || !guilds[guildObjIdx].entermessage) return;

    let guild = guilds[guildObjIdx];

    if (guild.destChannel) {
        if (typeof guild.destChannel === 'string') {
            console.log(`Resolving channel ${guild.destChannel} for guild ${guild.id}`);
            client.guilds.fetch(guild.id).then(guildobj=>{
                guilds[guildObjIdx].destChannel = guildobj.channels.resolve(guild.destChannel);
                guild.destChannel.send(kojimaizer(member.user.username));
            });
        } else {
            guild.destChannel.send(kojimaizer(member.user.username));
        }
    }
});

client.on('guildMemberRemove', member => {
    let djsguild = member.guild;
    let guildObjIdx = guilds.findIndex(fguild=>fguild.id===djsguild.id);
    if (guildObjIdx === -1 || !guilds[guildObjIdx].leavemessage) return;

    let guild = guilds[guildObjIdx];

    if (guild.destChannel) {
        if (typeof guild.destChannel === 'string') {
            console.log(`Resolving channel ${guild.destChannel} for guild ${guild.id}`);
            client.guilds.fetch(guild.id).then(guildobj=>{
                guilds[guildObjIdx].destChannel = guildobj.channels.resolve(guild.destChannel);
                guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye'));
            });
        } else {
            guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye'));
        }
    }
});

client.on('message', message => {
    if (!message.guild) return;
    let guildObjIdx = guilds.findIndex(guild=>guild.id===message.guild.id);
    if (guildObjIdx === -1) {
        guildObjIdx = guilds.length;
        guilds.push({
            id: message.guild.id,
            destChannel: null,
            lastUsername: null,
            entermessage: false,
            leavemessage: false
        });
        pgclient.query(`INSERT INTO guilds (gid, cid) VALUES ('${message.guild.id}','0');`);
    }
    if (message.mentions.has(message.guild.me) && message.member.permissions.has('MANAGE_GUILD', true) && !message.author.bot) {
        if (message.content.indexOf('help') > -1) {
            message.react('📤');
            message.author.send('Hi Admin\n\nHere Are My Commands:\n `@HIDEO_KOJIMA help` - DM My Commands To You\n `@HIDEO_KOJIMA setchannel` - Set The Channel Where I Send Messages To The Channel Where You Entered The Command\n `@HIDEO_KOJIMA togglewelcome` - Enable Or Disable Welcome Messages\n `@HIDEO_KOJIMA togglefarewell` - Enable Or Disable Farewell Messages\n');
        } else if (message.content.indexOf('setchannel') > -1) {
            let perms = new Discord.Permissions(message.channel.permissionsFor(message.guild.me).bitfield);
            if (perms.has('SEND_MESSAGES')) {
                console.log(`Set channel for ${guilds[guildObjIdx].id} to ${message.channel.id}`);
                guilds[guildObjIdx].destChannel = message.channel;
                message.channel.send('Hi Ad Min\n\nI Set The Current Channel To This One');
                pgclient.query(`UPDATE guilds SET cid='${message.channel.id}' WHERE gid='${guilds[guildObjIdx].id}';`);
            } else {
                message.author.send(`Hi Ad Min\n\nI Can't Send Messages In #${message.channel.name} So I Did Not Change The Channel`);
            }
        } else if (message.content.indexOf('togglewelcome') > -1) {
            guilds[guildObjIdx].entermessage = !guilds[guildObjIdx].entermessage;
            console.log(`${guilds[guildObjIdx].entermessage ? 'Enabled' : 'Disabled'} welcome for ${guilds[guildObjIdx].id}`);
            message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].entermessage ? 'Now' : 'Not'} Greet People When They Join`);
            pgclient.query(`UPDATE guilds SET entermsg='${guilds[guildObjIdx].entermessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
        } else if (message.content.indexOf('togglefarewell') > -1) {
            guilds[guildObjIdx].leavemessage = !guilds[guildObjIdx].leavemessage;
            console.log(`${guilds[guildObjIdx].leavemessage ? 'Enabled' : 'Disabled'} farewell for ${guilds[guildObjIdx].id}`);
            message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].leavemessage ? 'Now' : 'Not'} Greet People When They Leave`);
            pgclient.query(`UPDATE guilds SET leavemsg='${guilds[guildObjIdx].leavemessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
        }
        return;
    }
    if (message.member.id === message.guild.me.id) return;
    let cidtest = guilds[guildObjIdx].destChannel;
    if (typeof cidtest !== 'string') cidtest = cidtest.id;
    if (message.channel.id !== cidtest) return;
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
            lastUsername: null,
            entermessage: row.entermsg,
            leavemessage: row.leavemsg
        });
    }
    console.log('Logging into discord');
    client.login(process.env.BOTTOKEN);
});