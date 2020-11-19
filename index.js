const Discord = require('discord.js');
const client = new Discord.Client({
    disableMentions: 'everyone',
    ws: {
        intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES', 'GUILD_BANS', 'GUILD_WEBHOOKS', 'DIRECT_MESSAGES']
    }
});
const { Client: pgClient } = require('pg');
const fetch = require('node-fetch');
const DBL = require('dblapi.js');
const dbl = new DBL(process.env.DBLTOKEN, client);

const kojimaizer = require('./kojimaizer');
const katakanaifier = require('./katakanaifier');
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

const postBotStats = () => {
    let totalMembers = client.guilds.cache.reduce((a,c)=>a+c.memberCount,0);
    let totalGuilds = client.guilds.cache.size;
    console.log(`${totalMembers} in ${totalGuilds}`);
    // dbl handled by module
    // discordbotlist.com
    fetch(`https://discordbotlist.com/api/v1/bots/${client.user.id}/stats`, {
        method: 'POST',
        headers: {
            'Authorization': process.env.DBOTTOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            users: totalMembers,
            guilds: totalGuilds
        })
    })
    // discord.bots.gg
    fetch(`https://discord.bots.gg/api/v1/bots/${client.user.id}/stats`, {
        method: 'POST',
        headers: {
            'Authorization': process.env.BOTSGGTOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            guildCount: totalGuilds
        })
    })
    // bots.ondiscord.xyz
    fetch(`https://bots.ondiscord.xyz/bot-api/bots/${client.user.id}/guilds`, {
        method: 'POST',
        headers: {
            'Authorization': process.env.BOTSONDISCORDTOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            guildCount: totalGuilds
        })
    })
};

dbl.on('posted', postBotStats);

client.once('ready', () => {
    client.user.setActivity("Hi Sponge Bob"); 
    console.log('Login success');
    console.log(client.guilds.cache.map(g=>({ id: g.id, name: g.name, memberCount: g.memberCount })));
    postBotStats();
});

const sendMessageInGuild = (guild, message, messagejp) => {
    console.log('Message(en):',message);
    console.log('Message(jp):',messagejp);
    if (guild.jpenabled && guild.destChannel.guild.me.hasPermission('MANAGE_WEBHOOKS')) {
        guild.destChannel.fetchWebhooks().then(webhooks=>{
            if (webhooks.size < 1) return guild.destChannel.createWebhook('小島秀夫', {avatarURL: 'https://kojimaize.xyz/img/kojimajp.jpg'});
            return webhooks.first();
        }).then(webhook=>{
            webhook.send(messagejp, {
                username: '小島秀夫',
                avatarURL: 'https://kojimaize.xyz/img/kojimajp.jpg',
            });
        }).catch(e=>console.log(`Error sending message: ${e}`));
    } else {
        guild.destChannel.send(message).catch(e=>console.log(`Error sending message: ${e}`));
    }
}

setInterval(()=>{
    let count = 0;
    console.log(`Evaluating whether to send messages to ${guilds.length} guilds`);
    guilds.forEach((guild, idx) => {
        if (guild.destChannel && guild.lastUsername && guild.greetInt && guild.greetedLast && Math.floor(Math.abs(new Date() - guild.greetedLast)/60000) >= guild.greetInt && guild.greetInt > 0) {
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
                    //guild.destChannel.send(kojimaizer(guild.lastUsername));
                    katakanaifier(guild.lastUsername).then(jp=>{
                        sendMessageInGuild(guild, kojimaizer(guild.lastUsername), `こんにちは ${jp}`);
                    });
                }).catch(()=>console.log(`Couldn't fetch guild ${guild.id}, maybe the bot was kicked?`));
            } else {
                katakanaifier(guild.lastUsername).then(jp=>{
                    sendMessageInGuild(guild, kojimaizer(guild.lastUsername), `こんにちは ${jp}`);
                });
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
                //guild.destChannel.send(kojimaizer(member.user.username) + ` <@!${member.id}>`).catch(e=>console.log(`Error sending message: ${e}`));
                katakanaifier(guild.lastUsername).then(jp=>{
                    sendMessageInGuild(guild, kojimaizer(member.user.username) + ` <@!${member.id}>`, `こんにちは ${jp} <@!${member.id}>`);
                });
            });
        } else {
            //guild.destChannel.send(kojimaizer(member.user.username) + ` <@!${member.id}>`).catch(e=>console.log(`Error sending message: ${e}`));
            katakanaifier(guild.lastUsername).then(jp=>{
                sendMessageInGuild(guild, kojimaizer(member.user.username) + ` <@!${member.id}>`, `こんにちは ${jp} <@!${member.id}>`);
            });
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
                //guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`).catch(e=>console.log(`Error sending message: ${e}`));
                katakanaifier(guild.lastUsername).then(jp=>{
                    sendMessageInGuild(guild, kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`, `さようなら ${jp} (${member.user.username}#${member.user.discriminator})`);
                });
            });
        } else {
            //guild.destChannel.send(kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`).catch(e=>console.log(`Error sending message: ${e}`));
            katakanaifier(guild.lastUsername).then(jp=>{
                sendMessageInGuild(guild, kojimaizer(member.user.username).replace(/^Hi/, 'Bye') + ` (${member.user.username}#${member.user.discriminator})`, `さようなら ${jp} (${member.user.username}#${member.user.discriminator})`);
            });
        }
    }
});

client.on('message', message => {
    if (!message) return;
    let guildObjIdx = message.guild ? guilds.findIndex(guild=>guild.id===message.guild.id) : -2;
    if (guildObjIdx === -1) {
        guildObjIdx = guilds.length;
        guilds.push({
            id: message.guild.id,
            destChannel: null,
            lastUsername: null,
            entermessage: false,
            leavemessage: false,
            greetInt: 15,
            greetedLast: new Date(),
            jpenabled: false
        });
        pgclient.query(`INSERT INTO guilds (gid, cid) VALUES ('${message.guild.id}','0');`);
    }
    if (message.channel.type==='dm') console.log('Got DM');
    if (((message.guild && message.member && message.mentions.has(message.guild.me)) || message.channel.type==='dm') && message.content.indexOf('help') > -1 && !message.author.bot) {
        console.log('Sending help');
        const prefix = `@HIDEO_KOJIMA`;
        const helpEmbed = new Discord.MessageEmbed()
            .setColor('#1DA1F2')
            .setTitle('HIDEO_KOJIMA Help')
            .setURL('https://kojimaize.xyz/')
            .setDescription(`${kojimaizer(message.author.username)}\n\nHere Are My Commands:`)
            .setThumbnail('https://kojimaize.xyz/img/kojima.jpg')
            .addFields(
                { name: `${prefix} help`, value: 'DM My Commands To You' },
                { name: `help (DMs)`, value: 'DM My Commands To You' },
                { name: `${prefix} setchannel \`<channel>\``, value: 'Set The Channel Where I Send Messages To' },
                { name: `${prefix} togglewelcome`, value: 'Enable Or Disable Welcome Messages' },
                { name: `${prefix} togglefarewell`, value: 'Enable Or Disable Leave Messages' },
                { name: `${prefix} setinterval \`<interval>\``, value: 'Set Random User Greet Interval To <interval> - Set To 0 To Disable Random Greetings' },
                { name: `${prefix} togglejp`, value: 'Toggle Japanese Mode - Requires KojimaBot To Have Manage Webhooks Permissions' },
                { name: '\u200B', value: '\u200B' },
                { name: 'Vote Greets', value: 'If You Vote For KojimaBot On [Top.gg](https://top.gg/bot/753757823535677561) Or [DiscordBotList](https://discord.ly/hideokojima) You Will Recieve A Credit.'},
                { name: `${prefix} hi`, value: 'Have HIDEO Greet You In Exchange For 1 Credit' },
                { name: `checkbalance (DMs)`, value: 'See How Many Credits You Have' },
            );
        if (message.guild) message.author.send(helpEmbed).then(()=>message.react('📤').catch(()=>console.log("Couldn't react"))).catch(()=>console.log("Couldn't send DM"));
        else message.channel.send(helpEmbed);
        return;
    } else if (message.channel.type==='dm' && message.content.indexOf('checkbalance') > -1 && !message.author.bot) {
        pgclient.query(`SELECT * FROM votes WHERE uid='${message.author.id}';`, (err, res)=>{
            if (err) throw err;
            console.log(`Vote row count for ${message.author.id} is ${res.rows.length}`);
            let votecount = 0;
            if (res.rows.length > 0) {
                votecount = res.rows[0].count;
            }
            message.channel.send(`Current Balance Is ${votecount} Credits\n\nVote On Top.gg https://top.gg/bot/753757823535677561 Or DiscordBotList https://discord.ly/hideokojima To Get More`);
        })
    } else if (message.guild && message.member && message.mentions.has(message.guild.me) && message.member.permissions.has('MANAGE_GUILD', true) && !message.author.bot) {
        if (message.content.indexOf('setchannel') > -1) {
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
            return;
        } else if (message.content.indexOf('togglewelcome') > -1) {
            guilds[guildObjIdx].entermessage = !guilds[guildObjIdx].entermessage;
            console.log(`${guilds[guildObjIdx].entermessage ? 'Enabled' : 'Disabled'} welcome for ${guilds[guildObjIdx].id}`);
            message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].entermessage ? 'Now' : 'Not'} Greet People When They Join`).catch(e=>console.log(`Error sending message: ${e}`));
            pgclient.query(`UPDATE guilds SET entermsg='${guilds[guildObjIdx].entermessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
            return;
        } else if (message.content.indexOf('togglefarewell') > -1) {
            guilds[guildObjIdx].leavemessage = !guilds[guildObjIdx].leavemessage;
            console.log(`${guilds[guildObjIdx].leavemessage ? 'Enabled' : 'Disabled'} farewell for ${guilds[guildObjIdx].id}`);
            message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].leavemessage ? 'Now' : 'Not'} Greet People When They Leave`).catch(e=>console.log(`Error sending message: ${e}`));
            pgclient.query(`UPDATE guilds SET leavemsg='${guilds[guildObjIdx].leavemessage}' WHERE gid='${guilds[guildObjIdx].id}';`);
            return;
        } else if (message.content.indexOf('togglejp') > -1) {
            guilds[guildObjIdx].jpenabled = !guilds[guildObjIdx].jpenabled;
            console.log(`${guilds[guildObjIdx].jpenabled ? 'Enabled' : 'Disabled'} japanese mode for ${guilds[guildObjIdx].id}`);
            message.channel.send(`Hi Ad Min\n\nI Will ${guilds[guildObjIdx].jpenabled ? 'Now' : 'Not'} Greet People In Japanese${guilds[guildObjIdx].jpenabled ? '\nMake Sure To Give Me Manage Webhooks Permissions' : ''}`).catch(e=>console.log(`Error sending message: ${e}`));
            pgclient.query(`UPDATE guilds SET jpenabled='${guilds[guildObjIdx].jpenabled}' WHERE gid='${guilds[guildObjIdx].id}';`);
            return;
        } else if (message.content.indexOf('setinterval') > -1) {
            let interv = intervalToMin(message.content.split(' ').pop());
            if (isNaN(interv)) return;
            guilds[guildObjIdx].greetInt = interv;
            console.log(`Set greet interval for ${guilds[guildObjIdx].id} to ${interv} minutes`);
            message.channel.send(`Hi Ad Min\n\nI Will Say Hi Every ${minToInterval(interv)}`).catch(e=>console.log(`Error sending message: ${e}`));
            pgclient.query(`UPDATE guilds SET greetinterval=${guilds[guildObjIdx].greetInt} WHERE gid='${guilds[guildObjIdx].id}';`);
            return;
        }
    }
    if (message.guild) {
        if ((message.member && (message.member.id === message.guild.me.id)) || message.webhookID || !guilds[guildObjIdx].destChannel) return;
        let cidtest = guilds[guildObjIdx].destChannel;
        if (typeof cidtest !== 'string') cidtest = cidtest.id;
        if (message.channel.id !== cidtest) return;

        if (message.mentions.has(message.guild.me) && message.content.indexOf('hi') > -1) {
            pgclient.query(`SELECT * FROM votes WHERE uid='${message.author.id}';`, (err, res)=>{
                if (err) throw err;
                console.log(`Vote row count for ${message.author.id} is ${res.rows.length}`);
                let votecount = 0;
                if (res.rows.length > 0) {
                    votecount = res.rows[0].count;
                }
                if (votecount > 0) {
                    if (typeof guilds[guildObjIdx].destChannel === 'string') {
                        console.log(`Resolving channel ${guilds[guildObjIdx].destChannel} for guild ${guilds[guildObjIdx].id}`);
                        client.guilds.fetch(guilds[guildObjIdx].id).then(guildobj=>{
                            let bak = guilds[guildObjIdx].destChannel;
                            guilds[guildObjIdx].destChannel = guildobj.channels.resolve(guilds[guildObjIdx].destChannel);
                            if (!guilds[guildObjIdx].destChannel) {
                                guilds[guildObjIdx].destChannel = bak;
                                console.log(`Couldn't resolve channel ${guilds[guildObjIdx].destChannel} in ${guilds[guildObjIdx].id}.`);
                                return;
                            }
                            console.log('Saying hi to', message.author.username);
                            katakanaifier(message.author.username).then(jp=>{
                                sendMessageInGuild(guilds[guildObjIdx], kojimaizer(message.author.username), `こんにちは ${jp}`);
                            }).catch(e=>console.log('espeak error', e));
                        }).catch(()=>console.log(`Couldn't fetch guild ${guilds[guildObjIdx].id}, maybe the bot was kicked?`));
                    } else {
                        console.log('Saying hi to', message.author.username);
                        katakanaifier(message.author.username).then(jp=>{
                            sendMessageInGuild(guilds[guildObjIdx], kojimaizer(message.author.username), `こんにちは ${jp}`);
                        }).catch(e=>console.log('espeak error', e));
                    }
                    pgclient.query(`UPDATE votes SET count=${votecount-1} WHERE uid='${message.author.id}'`);
                } else {
                    message.author.send(`You Have No Credits Left\n\nVote On Top.gg https://top.gg/bot/753757823535677561 Or DiscordBotList https://discord.ly/hideokojima To Get More`)
                }
            })
        }
    
        guilds[guildObjIdx].lastUsername = message.author.username;
        console.log(guilds[guildObjIdx].lastUsername);
    }
});

client.on('guildCreate', guild=>{
    console.log(`Joined new guild ${guild.name}!`);
    postBotStats();
});

client.on('guildDelete', guild=>{
    console.log(`Left guild ${guild.name} ${guild.id}`);
    postBotStats();
});

console.log('Querying postgresql db');
pgclient.query('SELECT * FROM guilds;', (err, res)=>{
    if (err) throw err;
    console.log('Responded with row count', res.rows.length);
    for (let row of res.rows) {
        //console.log(row);
        guilds.push({
            id: row.gid,
            destChannel: row.cid,
            lastUsername: null,
            entermessage: row.entermsg,
            leavemessage: row.leavemsg,
            greetInt: row.greetinterval,
            greetedLast: row.greetedlast,
            jpenabled: row.jpenabled
        });
    }
    console.log('Logging into discord');
    client.login(process.env.BOTTOKEN);
});