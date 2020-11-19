const express = require('express');
const app = express();

const { Client: pgClient } = require('pg');
const pgclient = new pgClient({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pgclient.connect();

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.text());

const path = require('path');

app.use(express.static(path.join(__dirname,'web')));

const kojimaizer = require('./kojimaizer');
const katakanaifier = require('./katakanaifier');

app.post('/kojimaize', (req, res)=>{
    console.log('Got kojimaize request:', req.body)
    if (!req.body) {
        res.status(400).send("Missing/invalid request body");
        return;
    }
    res.send(kojimaizer(req.body));
});

app.post('/katakanaize', (req, res)=>{
    console.log('Got katakanaize request:', req.body);
    if (!req.body) {
        res.status(400).send("Missing/invalid request body");
        return;
    }
    katakanaifier(req.body).then(jp=>res.send(`こんにちは ${jp}`));
});

app.post('/webhooks/dbl', (req, res)=>{
    console.log('Got DBL (top.gg) webhook:', req.body);
    if (!req.body || !req.body.user) {
        res.status(400).send("Missing/invalid request body");
        return;
    }
    if (req.headers.authorization !== process.env.DBLWEBHOOKAUTH) {
        res.status(403).send("Missing/incorrect authorization");
        return;
    }
    let voteinc = req.body.isWeekend ? 2 : 1;
    if (req.body.type==="test") {
        console.log("Test fired, not modifying DB");
    } else {
        pgclient.query(`INSERT INTO votes (uid, count) VALUES ('${req.body.user}', ${voteinc}) ON CONFLICT (uid) DO UPDATE SET count = excluded.count + votes.count;`);
    }
    res.send("Success");
});

app.post('/webhooks/dbotlist', (req, res)=>{
    console.log('Got Discord Bot List (discordbotlist.com) webhook:', req.body);
    if (!req.body || !req.body.id) {
        res.status(400).send("Missing/invalid request body");
        return;
    }
    if (req.headers.authorization !== process.env.DBOTWEBHOOKAUTH) {
        res.status(403).send("Missing/incorrect authorization");
        return;
    }
    pgclient.query(`INSERT INTO votes (uid, count) VALUES ('${req.body.id}', 1) ON CONFLICT (uid) DO UPDATE SET count = excluded.count + votes.count;`);
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`Listening on ${port}`));