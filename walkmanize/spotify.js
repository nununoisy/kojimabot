const Spotify = require('node-spotify-api');

const spotify = new Spotify({
    id: process.env.SPOTIFY_CLIENT_ID,
    secret: process.env.SPOTIFY_CLIENT_SECRET
});

const spotifySearch = query => new Promise((resolve, reject)=>{
    spotify.search({
        type: 'track',
        query
    }, (err, data)=>{
        if (err) return reject(err);

        if (data.tracks.total == 0) return reject(new Error("Spotify search returned no results"));

        let item = data.tracks.items[0];
        resolve({
            title: item.name,
            album: item.album.name,
            artist: item.artists[0].name,
            imgurl: item.album.images.sort((a,b)=>b.width-a.width)[0].url,
            link: item.external_urls.spotify || ""
        });
    })
});

module.exports = spotifySearch;