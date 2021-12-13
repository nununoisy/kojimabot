import SpotifyWebApi from "spotify-web-api-node";
import fetch from "node-fetch";

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

interface IWalkmanizerSearchResult {
    title: string;
    album: string;
    artist: string;
    albumArtUrl: string;
    link?: string;
}

const spotifyValidateToken = async () => {
    if (!spotifyApi.getAccessToken()) {
        const grantData = await spotifyApi.clientCredentialsGrant();
        console.log('Spotify API access token: ', grantData.body['access_token']);
        console.log('Spotify API access token expires in: ', grantData.body['expires_in']);
        spotifyApi.setAccessToken(grantData.body['access_token']);
    }
}

export const SpotifySearch = async (query: string): Promise<IWalkmanizerSearchResult | null> => {
    await spotifyValidateToken();
    const searchResults = await spotifyApi.searchTracks(query, { limit: 1 });
    if (!searchResults.body.tracks || searchResults.body.tracks.items.length === 0) {
        return null;
    }
    const track = searchResults.body.tracks.items[0];
    return {
        title: track.name,
        album: track.album.name,
        artist: track.artists[0].name,
        albumArtUrl: track.album.images.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url,
        link: track.external_urls.spotify
    };
}

export const SpotifyAutocomplete = async (query: string): Promise<IWalkmanizerSearchResult[]> => {
    await spotifyValidateToken();
    const searchResults = await spotifyApi.searchTracks(query, { limit: 10 });
    if (!searchResults.body.tracks || searchResults.body.tracks.items.length === 0) {
        return [];
    }
    return searchResults.body.tracks.items.map(track => ({
        title: track.name,
        album: track.album.name,
        artist: track.artists[0].name,
        albumArtUrl: track.album.images.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url,
        link: track.external_urls.spotify
    }));
}

interface IDeezerArtist {
    id: number;
    name: string;
    picture: string;
    picture_small: string;
    picture_medium: string;
    picture_big: string;
    picture_xl: string;
    type: 'artist';
}

interface IDeezerAlbum {
    id: number;
    title: string;
    cover: string;
    cover_small: string;
    cover_medium: string;
    cover_big: string;
    cover_xl: string;
    type: 'album';
}

interface IDeezerTrack {
    id: number;
    readable: boolean;
    title: string;
    title_short: string;
    title_version: string;
    link: string;
    duration: number;
    rank: number;
    explicit_lyrics: boolean;
    explicit_content_lyrics: number;
    explicit_content_cover: number;
    preview: string;
    md5_image: string;
    artist: IDeezerArtist;
    album: IDeezerAlbum;
    type: 'track';
}

interface IDeezerResponse {
    data: IDeezerTrack[];
    total: number;
    next?: string;
}

export const DeezerSearch = async (query: string): Promise<IWalkmanizerSearchResult | null> => {
    const deezerResponse = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        method: 'GET'
    });
    const deezerData = await deezerResponse.json() as IDeezerResponse;
    if (!deezerData.data || deezerData.total === 0) {
        return null;
    }
    const track = deezerData.data[0];
    return {
        title: track.title,
        album: track.album.title,
        artist: track.artist.name,
        albumArtUrl: track.album.cover_xl,
        link: track.link
    };
}