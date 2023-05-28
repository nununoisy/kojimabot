import {ApplicationCommandData} from "discord.js";

const commands: ApplicationCommandData[] = [
    {
        name: 'setchannel',
        description: 'Change Where I Will Greet Members',
        type: 'CHAT_INPUT',
        options: [{
            name: 'channel',
            description: 'The Channel To Post Greetings In',
            type: 'CHANNEL',
            required: true
        }]
    },
    {
        name: 'setinterval',
        description: 'Change How Often I Will Greet Members',
        type: 'CHAT_INPUT',
        options: [{
            name: 'interval',
            description: 'The Length Of Time Between Greetings In Minutes',
            type: 'INTEGER',
            required: true
        }]
    },
    {
        name: 'joinmessages',
        description: 'Change Whether I Will Greet Members When They Join',
        type: 'CHAT_INPUT',
        options: [{
            name: 'enabled',
            description: 'Whether I Will Greet Members When They Join',
            type: 'BOOLEAN',
            required: true
        }]
    },
    {
        name: 'leavemessages',
        description: 'Change Whether I Will Say Farewell To Members When They Leave',
        type: 'CHAT_INPUT',
        options: [{
            name: 'enabled',
            description: 'Whether I Will Say Farewell To Members When They Leave',
            type: 'BOOLEAN',
            required: true
        }]
    },
    {
        name: 'japanesemode',
        description: 'Change Whether I Will Greet Members In Japanese',
        type: 'CHAT_INPUT',
        options: [{
            name: 'enabled',
            description: 'Whether I Will Greet Members In Japanese',
            type: 'BOOLEAN',
            required: true
        }]
    },
    {
        name: 'repeatgreetings',
        description: 'Change Whether I Will Greet Again If Nobody Has Spoken Since My Last Greeting',
        type: 'CHAT_INPUT',
        options: [{
            name: 'enabled',
            description: 'Whether I Will Greet Again If Nobody Has Spoken Since My Last Greeting',
            type: 'BOOLEAN',
            required: true
        }]
    },
    {
        name: 'checkbalance',
        description: 'Check Your Credit Balance For Fun Commands',
        type: 'CHAT_INPUT',
        options: []
    },
    {
        name: 'getcredits',
        description: 'Get Credits For Fun Commands',
        type: 'CHAT_INPUT',
        options: []
    },
    {
        name: 'greet',
        description: '[1 Credit] Greet Someone',
        type: 'CHAT_INPUT',
        options: [{
            name: 'user',
            description: 'The User To Greet (Leave Empty To Greet Yourself)',
            type: 'USER',
            required: false
        }]
    },
    {
        name: 'listen',
        description: '[2 Credits] Play A Song On My Walkman',
        type: 'CHAT_INPUT',
        options: [{
            name: 'song',
            description: 'The Song To Play (Searches Spotify)',
            type: 'STRING',
            required: true,
            autocomplete: true
        }]
    },
    {
        name: 'stealthgreet',
        description: '[2 Credits] Greet Someone Without Showing Your Username',
        type: 'CHAT_INPUT',
        options: [{
            name: 'user',
            description: 'The User To Greet (Leave Empty To Greet Yourself)',
            type: 'USER',
            required: false
        }]
    }
];

export default commands;