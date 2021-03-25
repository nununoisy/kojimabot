const { spawnSync } = require('child_process');
const path = require('path');
const fetch = require('node-fetch');
const deezerSearch = require('./deezer');
const spotifySearch = require('./spotify');

const Walkmanize = async (search) => {
    let songdata = null;
    let source = null;
    try {
        songdata = await spotifySearch(search);
        source = "spotify";
    } catch (e) {
        songdata = await deezerSearch(search);
        source = "deezer";
    }
    
    if (!songdata) throw new Error("Search returned no results");

    if (songdata.title.length > 25) songdata.title = songdata.title.slice(0,22) + '...';
    if (songdata.artist.length > 25) songdata.artist = songdata.artist.slice(0,22) + '...';
    if (songdata.album.length > 25) songdata.album = songdata.album.slice(0,22) + '...';
    let imgResponse = await fetch(songdata.imgurl);
    let imgbuf = await imgResponse.buffer();

    let magick = spawnSync('convert', [
        // start with transparent background
        '-background', 'transparent',
        // list[0] will be our album art
        'jpg:-',
        // first generate the blur gradient with alpha to list[1]
        '(',
            // clone list[0] (original image)
            '+clone',
            // generate alpha gradient
            '-matte', '(', 'mask.png', '-alpha', 'shape', ')',
            // compose them together
            '-compose', 'Dst_In', '-composite',
            // add blur effect
            '-blur', '0x8',
        ')',
        // compose blurred image w/ alpha gradient over original to create blur gradient
        '-compose', 'Over', '-composite',
        // pad album image with transparency for text
        '-gravity', 'north',
        '-resize', '1000x1200',
        '-extent', '1000x1200',
        // add song data text
        '-gravity', 'northwest',
        '-font', path.join(__dirname, 'Roboto-Regular.ttf'),
        '-pointsize', '51',
        '-fill', 'white',
        '-draw', `text 67,1017 "${songdata.title}"`,
        '-font', path.join(__dirname, 'Roboto-Medium.ttf'),
        '-pointsize', '42',
        '-draw', `text 67,1078 "${songdata.artist.toUpperCase()}"`,
        '-fill', '#949494',
        '-draw', `text 67,1129 "${songdata.album.toUpperCase()}"`,
        // distort album art/song text
        '-motion-blur', '3x8+90',
        '-matte', '-virtual-pixel', 'transparent',
        '-distort', 'Perspective', '0,0 184,116  999,0 685,-54  999,999 856,385  0,999 346,568',
        // combine with walkman
        '-compose', 'Dst_Over', 'hideowalkman.png', '-composite',
        '-trim', '+repage',
        // output to stdout as png
        'png:-'
    ], {
        cwd: __dirname,
        input: imgbuf
    });

    let finalimg = magick.stdout;

    return {
        finalimg,
        source,
        url: songdata.link
    };
}

module.exports = Walkmanize;