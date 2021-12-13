import { spawnSync } from 'child_process';
import path from 'path';
import fetch from 'node-fetch';
import { SpotifySearch, DeezerSearch } from './search';

interface IWalkmanizeResult {
    image: Buffer,
    source: 'spotify' | 'deezer',
    url?: string
}

const walkmanize = async (query: string): Promise<IWalkmanizeResult | null> => {
    let searchResult = await SpotifySearch(query);
    let source: ('spotify' | 'deezer') = 'spotify';
    if (!searchResult) {
        searchResult = await DeezerSearch(query);
        source = 'deezer';
        if (!searchResult) {
            return null;
        }
    }
    const title = (searchResult.title.length > 25) ? searchResult.title.slice(0, 22) + '...' : searchResult.title;
    const artist = (searchResult.artist.length > 25) ? searchResult.artist.slice(0, 22) + '...' : searchResult.artist;
    const album = (searchResult.album.length > 25) ? searchResult.album.slice(0, 22) + '...' : searchResult.album;

    if (!searchResult.albumArtUrl) {
        return null;
    }
    const imageResponse = await fetch(searchResult.albumArtUrl);
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    if (!imageArrayBuffer) {
        return null;
    }
    const image = Buffer.from(imageArrayBuffer);

    return new Promise<IWalkmanizeResult | null>((resolve, reject) => {
        const magick = spawnSync('convert', [
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
            '-draw', `text 67,1017 "${title}"`,
            '-font', path.join(__dirname, 'Roboto-Medium.ttf'),
            '-pointsize', '42',
            '-draw', `text 67,1078 "${artist.toUpperCase()}"`,
            '-fill', '#949494',
            '-draw', `text 67,1129 "${album.toUpperCase()}"`,
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
            input: image,
            maxBuffer: 1024 * 1024 * 10
        });

        resolve({
            image: magick.stdout,
            source,
            url: searchResult?.link
        });
    });
};

export default walkmanize;