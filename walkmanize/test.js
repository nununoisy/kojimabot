const walkmanize = require('./index');
const fs = require('fs');

walkmanize(process.argv.pop()).then(out=>{
    fs.writeFileSync('final.png', out.finalimg);
    console.log(out.source);
    console.log(out.url);
});