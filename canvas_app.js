const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('file-input');
const btnAction = document.getElementById('btn-action');
const btnUndo = document.getElementById('btn-undo');
const stepTitle = document.getElementById('step-title');

let img = null;
let points = [];
let currentPointIdx = 0;

btnAction.addEventListener('click', () => {
    if (!img) fileInput.click();
    else if (points.length === LANDMARKS_49.length) {
        let res = calculateHARM(points);
        showResults(res);
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            draw();
            updateStep();
            btnAction.innerText = "Завершить";
            btnAction.disabled = true;
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
});

canvas.addEventListener('pointerdown', (e) => {
    if (!img || currentPointIdx >= LANDMARKS_49.length) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    points.push({ x, y });
    currentPointIdx++;
    
    btnUndo.disabled = false;
    updateStep();
    draw();
});

btnUndo.addEventListener('click', () => {
    if (points.length > 0) {
        points.pop();
        currentPointIdx--;
        btnUndo.disabled = points.length === 0;
        btnAction.disabled = true;
        updateStep();
        draw();
    }
});

function updateStep() {
    if (currentPointIdx < LANDMARKS_49.length) {
        stepTitle.innerText = `Точка ${currentPointIdx + 1}/49: ${LANDMARKS_49[currentPointIdx]}`;
    } else {
        stepTitle.innerText = "Все 49 точек поставлены! Нажмите 'Завершить'.";
        btnAction.disabled = false;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img) ctx.drawImage(img, 0, 0);

    // Отрисовка точек
    points.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = idx === points.length - 1 ? '#00ff00' : '#0088cc';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });
}

function showResults(res) {
    document.getElementById('result-modal').style.display = 'block';
    document.getElementById('score-overview').innerHTML = `
        <h1 style="font-size:48px; color:#0088cc;">${res.score}/100</h1>
        <h3>${res.tier}</h3>
    `;
    
    let html = '';
    res.details.forEach(m => {
        html += `
            <div style="background:#16161a; padding:12px; margin-bottom:8px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div><strong>${m.name}</strong></div>
                    <div style="font-size:12px; color:#aaa;">Факт: ${m.val} | Идеал: ${m.ideal}</div>
                </div>
                <span class="badge ${m.status}">${m.dev}%</span>
            </div>
        `;
    });
    document.getElementById('metrics-list').innerHTML = html;
}
