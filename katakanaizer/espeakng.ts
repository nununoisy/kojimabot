interface IESpeakNGIPAResult {
    ipa: string,
    code: number
}

interface IESpeakNGWorker {
    synthesize_ipa: (word: string) => IESpeakNGIPAResult
}

export default class ESpeakNG {
    worker: Promise<IESpeakNGWorker>;

    constructor () {
        this.worker = require('./espeakng.worker');
    }

    async synthesizeIPA(word: string): Promise<string> {
        const espeakng: IESpeakNGWorker = await Promise.resolve(this.worker);
        const result: IESpeakNGIPAResult = espeakng.synthesize_ipa(word);

        if (result.code === 0) {
            return result.ipa;
        } else {
            throw new Error(`espeak-ng failed with code ${result.code}`);
        }
    }
}