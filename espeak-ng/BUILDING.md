# Building the espeak-ng module in Emscripten

1. Get emscripten installed and activated in your terminal.
2. Clone espeak-ng.
3. Compile the dictionary:
```bash
$ ./autogen.sh
$ ./configure --prefix=/usr --without-async --without-mbrola --without-sonic
$ make en
```
4. Re-make ucd-tools:
```bash
$ cd src/ucd-tools
$ ./autogen.sh
$ ./configure
$ make clean
$ emconfigure ./configure
$ emmake make
$ cd ../..
```
5. Recompile espeak-ng:
```bash
$ emconfigure ./configure --prefix=/usr --without-async --without-mbrola --without-sonic
$ emmake make clean
$ emmake make src/libespeak-ng.la
```
6. Patch the emscripten files to work with nodejs:
```bash
$ cd emscripten
$ # use @ as separator between phonemes
$ sed -e "s/' '/'@'/g" -i espeakng_glue.cpp
$ # use python3 for scripts, use --embed for node compatibility
$ # remove the python3 rule if your system's python 3.x is called python
$ sed -e 's/python/python3/g' -e 's/--preload/--embed/g' -i Makefile
$ # replace web worker code with node module code
$ sed -e '/\/\/ Make this a worker/Q' -i post.js
$ cat >> post.js <<'EOF'
module.exports = new Promise((resolve,reject)=>{
  Module.postRun = Module.postRun || [];
  Module.postRun.push(()=>{
    resolve(new eSpeakNGWorker())
  });
});
EOF
```
7. Build espeak-ng to JS:
```bash
$ emmake make
```
8. Finished file is in `js/espeakng.worker.js`