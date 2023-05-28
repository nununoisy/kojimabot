// ImageMagick command line generation
import { IWalkmanizeSearchResult } from "./search";
import path from "path";
import fetch from "node-fetch";

interface IWalkmanizeCommand {
    command: string;
    args: string[];
    input?: string | Buffer;
}

type WalkmanizeIMCommandGenerator = (searchResult: IWalkmanizeSearchResult) => Promise<IWalkmanizeCommand | null>;

/**
 * Try to load album art from an image URL.
 * @param url
 */
const loadAlbumArt = async (url: string): Promise<Buffer | null> => {
    if (!url)
        return null;

    try {
        const imageResponse = await fetch(url);
        if (imageResponse.ok) {
            const imageArrayBuffer = await imageResponse.arrayBuffer();
            if (!imageArrayBuffer)
                return null;
            return Buffer.from(imageArrayBuffer);
        }
        return null;
    } catch (e) {
        console.error(`Error when fetching album art at '${url}':`, e);
        return null;
    }
}

/**
 * Truncates a string to a maximum length and adds an ellipsis if necessary.
 * @param str
 * @param maxLength
 */
const ellipsis = (str: string, maxLength: number): string => {
    if (str.length > maxLength) {
        return str.substr(0, maxLength - 3) + "...";
    }
    return str;
}

/**
 * Get a base command with some common arguments.
 */
const getPartialBaseCommand = (): IWalkmanizeCommand => {
    if (process.env.USE_MAGICK_COMMAND)
        return {
            command: 'magick',
            args: ['convert']
        }
    else
        return {
            command: 'convert',
            args: []
        }
}

/**
 * Generate a command for the "normal" image.
 * @param searchResult
 */
export const NormalWalkman: WalkmanizeIMCommandGenerator = async (searchResult) => {
    const albumArt = await loadAlbumArt(searchResult.albumArtUrl);
    if (!albumArt)
        return null;

    const title = ellipsis(searchResult.title, 25);
    const artist = ellipsis(searchResult.artist, 25);
    const album = ellipsis(searchResult.album, 25);

    const baseCommand = getPartialBaseCommand();
    baseCommand.args.push(
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
    );

    return {
        command: baseCommand.command,
        args: baseCommand.args,
        input: albumArt
    };
}
