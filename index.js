const Discord = require('discord.js');
const client = new Discord.Client({disableMentions: 'everyone'});
const { Client: pgClient } = require('pg');

const kojimaizer = require('./kojimaizer');
const { intervalToMin, minToInterval } = require('./intervalHelper');

const postgresdate = d => `${d.getUTCFullYear()}-${('00'+(d.getUTCMonth()+1)).slice(-2)}-${('00'+d.getUTCDate()).slice(-2)} ${('00'+d.getUTCHours()).slice(-2)}:${('00'+d.getUTCMinutes()).slice(-2)}:${('00'+d.getUTCSeconds()).slice(-2)}`;

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
    console.log(client.guilds.cache.map(g=>({ id: g.id, name: g.name, memberCount: g.memberCount })));
});

setInterval(()=>{
    let count = 0;
    console.log(`Evaluating whether to send messages to ${guilds.length} guilds`);
    guilds.forEach((guild, idx) => {
        if (guild.destChannel && guild.lastUsername && guild.greetInt && guild.greetedLast && Math.floor(Math.abs(new Date() - guild.greetedLast)/60000) >= guild.greetInt) {
            count++;
            if (typeof guild.destChannel === 'string') {
                console.log(`Resolving channel ${guild.destChannel} for guild ${guild.id}`);
                client.guilds.fetch(guild.id).then(guildobj=>{
                    let bak = guild.destChannel;
                    guilds[idx].destChannel = guildobj.channels.resolve(guild.destChannel);
                    if (!guild.destChannel) {
                        guild.destChannel = bak;
                        console.log(`Couldn't resolve channel ${guild.destChannel} in ${guild.id}.`);
                        return;
                    }
                    guild.destChannel.send(kojimaizer(guild.lastUsername));
                }).catch(()=>console.log(`Couldn't fetch guild ${guild.id}, maybe the bot was kicked?`));
            } else {
                guild.destChannel.send(kojimaizer(guild.lastUsername));
            }
            guilds[idx].greetedLast = new Date();
            pgclient.query(`UPDATE guilds SET greetedlast='${postgresdate(new Date())}' WHERE gid='${guild.id}';`);
        }
    });
    console.log(`Sent messages to ${count} guilds`);
}, 60000);

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
                guild.destChannel.send(kojimaizer(member.user.username) + ` <@!${member.id}>`).catch(e=>console.log(`Error sending message: ${e}`));
            });
        } else {
            guild.destChannel.send(kojimaizer(member.user.username) + ` <@!${member.id}>`).catch(e=>console.log(`Error sending message: ${e}`));
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
                guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`).catch(e=>console.log(`Error sending message: ${e}`));
            });
        } else {
            guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`).catch(e=>console.log(`Error sending message: ${e}`));
        }
    }
});

client.on('message', message => {
    if (!message || !message.guild || !message.member) return;
    let guildObjIdx = guilds.findIndex(guild=>guild.id===message.guild.id);
    if (guildObjIdx === -1) {
        guildObjIdx = guilds.length;
        guilds.push({
            id: message.guild.id,
            destChannel: null,
            lastUsername: null,
            entermessage: false,
            leavemessage: false,
            greetInt: 15,
            greetedLast: new Date()
        });
        pgclient.query(`INSERT INTO guilds (gid, cid) VALUES ('${message.guild.id}','0');`);
    }
    if (message.mentions.has(message.guild.me) && message.member.permissions.has('MANAGE_GUILD', true) && !message.author.bot) {
        if (message.content.indexOf('help') > -1) {
            message.react('📤');
            message.author.send('Hi Admin\n\nHere Are My Commands:\n `@HIDEO_KOJIMA help` - DM My Commands To You\n `@HIDEO_KOJIMA setchannel` - Set The Channel Where I Send Messages To The Channel Where You Entered The Command\n `@HIDEO_KOJIMA setchannel <channel>` - Set The Channel Where I Send Messages To <channel>\n `@HIDEO_KOJIMA togglewelcome` - Enable Or Disable Welcome Messages\n `@HIDEO_KOJIMA togglefarewell` - Enable Or Disable Farewell Messages\n `@HIDEO_KOJIMA setinterval <interval>` - Set Random User Greet Interval To <interval> Minutes\n').catch(e=>console.log(`Error sending message: ${e}`));
        } else if (message.content.indexOf('setchannel') > -1) {
            let channel = message.mentions.channels.first() || message.channel;
            let perms = new Discord.Permissions(channel.permissionsFor(message.guild.me).bitfield);
            if (perms.has('SEND_MESSAGES')) {
                console.log(`Set channel for ${guilds[guildObjIdx].id} to ${channel.id}`);
                guilds[guildObjIdx].destChannel = channel;
                message.channel.send(`Hi Ad Min\n\nI Set The Channel To ${message.mentions.channels ? '<#'+channel.id+'>' : 'This One'}`).catch(e=>console.log(`Error sending message: ${e}`));
                pgclient.query(`UPDATE guilds SET cid='${channel.id}' WHERE gid='${guilds[guildObjIdx].id}';`);
            } else {
                message.author.send(`Hi Ad Min\n\nI Can't Send Messages In #${channel.name} So I Did Not Change The Channel`).catch(e=>console.log(`Error sending message: ${e}`));
            }
        } else if (message.content.indexOf('togglewelcome') > -1) {
            guilds[guildObjIdx].entermessage = !guilds[guildObjIdx].entermessage;
            console.log(`${guilds[guildObjIdx].entermessage ? 'Enabled' : 'Disabled'} welcome for ${guilds[guildObjIdx].id}`);
            message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].entermessage ? 'Now' : 'Not'} Greet People When They Join`).catch(e=>console.log(`Error sending message: ${e}`));
            pgclient.query(`UPDATE guilds SET entermsg='${guilds[guildObjIdx].entermessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
        } else if (message.content.indexOf('togglefarewell') > -1) {
            guilds[guildObjIdx].leavemessage = !guilds[guildObjIdx].leavemessage;
            console.log(`${guilds[guildObjIdx].leavemessage ? 'Enabled' : 'Disabled'} farewell for ${guilds[guildObjIdx].id}`);
            message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].leavemessage ? 'Now' : 'Not'} Greet People When They Leave`).catch(e=>console.log(`Error sending message: ${e}`));
            pgclient.query(`UPDATE guilds SET leavemsg='${guilds[guildObjIdx].leavemessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
        } else if (message.content.indexOf('setinterval') > -1) {
            let interv = intervalToMin(message.content.split(' ').pop());
            if (isNaN(interv)) return;
            guilds[guildObjIdx].greetInt = interv;
            console.log(`Set greet interval for ${guilds[guildObjIdx].id} to ${interv} minutes`);
            message.channel.send(`Hi Ad Min\n\nI Will Say Hi Every ${minToInterval(interv)}`).catch(e=>console.log(`Error sending message: ${e}`));
            pgclient.query(`UPDATE guilds SET greetinterval=${guilds[guildObjIdx].greetInt} WHERE gid='${guilds[guildObjIdx].id}';`)
        }
        return;
    }
    if (message.member.id === message.guild.me.id || !guilds[guildObjIdx].destChannel) return;
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
            leavemessage: row.leavemsg,
            greetInt: row.greetinterval,
            greetedLast: row.greetedlast
        });
    }
    console.log('Logging into discord');
    client.login(process.env.BOTTOKEN);
});