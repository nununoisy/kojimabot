const input = document.querySelector('#input');
const output = document.querySelector('#output');

const datefield = document.querySelector('#date');
const now = new Date();

const spinner = document.querySelector('#spinner');

const img = document.querySelector('#pfp');
const fname = document.querySelector('#fname');
const uname = document.querySelector('#uname');
let jp = false;

const savebtn = document.querySelector('#save');

let controller = new AbortController();

datefield.innerHTML = `${(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])[now.getMonth()]} ${now.getDate()}`;

const setJP = () => {
    controller.abort();
    controller = new AbortController();
    window.location.hash = (jp ? 'jp:' : '') + window.location.hash.replace(/^#(jp:)?/,'');
    if (jp) {
        img.src = '/img/kojimajp.jpg';
        fname.innerHTML = '小島秀夫';
        uname.innerHTML = '@Kojima_Hideo';
    } else {
        img.src = '/img/kojima.jpg';
        fname.innerHTML = 'HIDEO_KOJIMA';
        uname.innerHTML = '@HIDEO_KOJIMA_EN';
    }
    if (input.value === '') {
        output.innerHTML = jp ? "こんにちは セプンチャ ボブ" : "Hi Sponge Bob";
        return;
    }
    spinner.style.display = 'inline-block';
    output.innerHTML = '';
    fetch(jp ? '/katakanaize' : '/kojimaize', {
        method: 'POST',
        body: input.value,
        signal: controller.signal
    }).then(r=>r.text()).then(response=>{
        spinner.style.display = 'none';
        output.innerHTML = response;
    }).catch(err=>console.log(err));
}

if (window.location.hash) {
    input.value = decodeURI(window.location.hash.replace(/^#(jp:)?/,''));
    jp = window.location.hash.startsWith('#jp:');
    setJP();
} else {
    input.value = "SpongeBob";
}

img.addEventListener('click', ()=>{
    jp=!jp;
    setJP();
})

input.addEventListener('input', e=>{
    window.location.hash = encodeURI((jp ? 'jp:' : '') + e.target.value);
    if (e.target.value === '') {
        output.innerHTML = jp ? "こんにちは セプンチャ ボブ" : "Hi Sponge Bob";
        return;
    }
    spinner.style.display = 'inline-block';
    output.innerHTML = '';
    setJP();
});

savebtn.addEventListener('click', ()=>{
    const svgElements = document.body.querySelectorAll('svg');
    svgElements.forEach(function(item) {
        item.setAttribute("width", item.getBoundingClientRect().height);
        item.setAttribute("height", item.getBoundingClientRect().height);
    });
    html2canvas(document.querySelector("#capture"), {
        allowTaint: true,
        backgroundColor: '#15202b'
    }).then(canvas => {
        canvas.toBlob(blob=>{
            saveAs(blob, 'kojima.png');
        }, 'image/png');
    });
});