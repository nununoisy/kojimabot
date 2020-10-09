const input = document.querySelector('#input');
const output = document.querySelector('#output');

const datefield = document.querySelector('#date');
const now = new Date();

const savebtn = document.querySelector('#save');

datefield.innerHTML = `${(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])[now.getMonth()]} ${now.getDate()}`;

if (window.location.hash) {
    input.value = decodeURI(window.location.hash.replace(/^#/,''));
    fetch(`/kojimaize`, {
        method: 'POST',
        body: input.value
    }).then(r=>r.text()).then(response=>{
        output.innerHTML = response;
    });
} else {
    input.value = "SpongeBob";
}

input.addEventListener('input', e=>{
    window.location.hash = encodeURI(e.target.value);
    if (e.target.value === '') {
        output.innerHTML = "Hi Sponge Bob";
        return;
    }
    fetch(`/kojimaize`, {
        method: 'POST',
        body: e.target.value
    }).then(r=>r.text()).then(response=>{
        output.innerHTML = response;
    });
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