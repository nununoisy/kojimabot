module.exports = async word => {
    const espeakng = await require('./espeakng.worker');

    const res = espeakng.synthesize_ipa(word);

    if (res.code === 0) return res.ipa;
    throw new Error(`espeak-ng failed with code ${res.code}`);
}