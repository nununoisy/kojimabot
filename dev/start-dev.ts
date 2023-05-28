import { fork } from 'child_process';

const startWithDevInfo = async (module: string) => {
    let childEnv = {...process.env};

    try {
        const devInfo = await import(`./dev-info`);
        childEnv = {...childEnv, ...devInfo.default};
    } catch (e) {
        console.log(`Development info not found.`);
    }

    console.log(`Starting ${module} with dev info...`);

    fork(module, [], {
        env: childEnv,
        stdio: 'inherit'
    });
}

(async () => {
    let [,, ...modules] = process.argv;
    if (modules.length === 0) {
        modules = ['bot', 'web'];
    }

    for (const moduleName of modules) {
        const module = moduleName.startsWith('./') ? moduleName : `./${moduleName}`;
        await startWithDevInfo(module);
    }
})();