const fetch = require('node-fetch');

const deezerSearch = async query => {
    let deezerResponse = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`,  {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });
    let deezerData = await deezerResponse.json();
    if (!deezerData || deezerData.total == 0) {
        throw new Error("Deezer search returned no results");
    }
    let songdata = deezerData.data[0];
    return {
        title: songdata.title,
        album: songdata.album.title,
        artist: songdata.artist.name,
        imgurl: songdata.album.cover_xl,
        link: songdata.link || ""
    };
};

module.exports = deezerSearch;