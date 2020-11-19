const worker = require('./espeakng.worker');

module.exports = async word => {
    const espeakng = await Promise.resolve(worker);

    const res = espeakng.synthesize_ipa(word);

    if (res.code === 0) return res.ipa;
    console.log('ESPEAK-NG ERROR');
    throw new Error(`espeak-ng failed with code ${res.code}`);
}