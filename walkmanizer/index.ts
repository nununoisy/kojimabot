import { spawnSync } from 'child_process';
import path from 'path';
import { SpotifySearch, DeezerSearch } from './search';
import { NormalWalkman } from "./magickcmdgen";

type WalkmanizeSearchSource = 'spotify' | 'deezer';
interface IWalkmanizeResult {
    image: Buffer,
    source: WalkmanizeSearchSource,
    url?: string
}

/**
 * Walkmanizes a song query.
 * Search for a song using a given query, then map the song's album art and
 * metadata to an image of Hideo Kojima's Walkman music player.
 * @param query
 */
const walkmanize = async (query: string): Promise<IWalkmanizeResult | null> => {
    // Try to find a song using the Spotify API
    let searchResult = await SpotifySearch(query);
    let source: WalkmanizeSearchSource = 'spotify';
    if (!searchResult) {
        searchResult = await DeezerSearch(query);
        source = 'deezer';
        if (!searchResult) {
            return null;
        }
    }

    const command = await NormalWalkman(searchResult);
    // TODO handle null command with fallback
    if (!command) {
        return null;
    }

    return new Promise<IWalkmanizeResult | null>((resolve, reject) => {
        const magick = spawnSync(command.command, command.args, {
            cwd: __dirname,
            input: command.input,
            // Increase buffer size to 10 MB to prevent image truncation
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