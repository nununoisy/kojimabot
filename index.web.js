const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.text({ type: '*/*' }));

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

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`Listening on ${port}`));