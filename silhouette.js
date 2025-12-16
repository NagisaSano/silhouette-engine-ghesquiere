const TARGET_SILHOUETTES = 10;
const MAX_ATTEMPTS = 60;

const rules = {
    shoulder: { sharp: { w: 80, h: 20 }, volume: { w: 120, h: 40 }, fluid: { w: 90, h: 25 } },
    col: { asym: { x: 20, y: 10 }, vneck: { x: 40, y: 30 }, oversize: { x: 0, y: 0 } },
    waist: { high: { y: 120 }, low: { y: 160 }, marked: { y: 140, curve: 15 } },
    length: { mini: 250, midi: 380, maxi: 500 },
    sleeve: { none: [], short: [{ x: 50, y: 120, w: 30, h: 40 }], long: [{ x: 45, y: 120, w: 25, h: 100 }] }
};

const labelMap = {
    shoulder: { sharp: 'Épaules sharp', volume: 'Épaules volume', fluid: 'Épaules fluides' },
    col: { asym: 'Col asymétrique', vneck: 'Col en V', oversize: 'Col oversize' },
    waist: { high: 'Taille haute', low: 'Taille basse', marked: 'Taille marquée' },
    length: { mini: 'Longueur mini', midi: 'Longueur midi', maxi: 'Longueur maxi' },
    sleeve: { none: 'Sans manches', short: 'Manches courtes', long: 'Manches longues' }
};

const forbiddenCombos = [
    { shoulder: 'volume', col: 'oversize', length: 'mini' }, // Volume + mini = non
    { shoulder: 'fluid', waist: 'low', sleeve: 'none' }      // Fluid + low + sans manches = non
];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('generateBtn').addEventListener('click', generateSilhouettes);
    document.getElementById('exportBtn').addEventListener('click', exportPDF);
    generateSilhouettes();
});

function getCurrentParams() {
    return {
        shoulder: document.getElementById('shoulder').value,
        col: document.getElementById('col').value,
        waist: document.getElementById('waist').value,
        length: document.getElementById('length').value,
        sleeve: document.getElementById('sleeve').value
    };
}

function pickRandomKey(group) {
    const keys = Object.keys(rules[group]);
    return keys[Math.floor(Math.random() * keys.length)];
}

function mutateParams(baseParams, attempt) {
    const variant = { ...baseParams };

    if (attempt % 3 === 0 || Math.random() > 0.6) variant.waist = pickRandomKey('waist');
    if (attempt % 2 === 0 || Math.random() > 0.65) variant.length = pickRandomKey('length');
    if (Math.random() > 0.75) variant.shoulder = pickRandomKey('shoulder');
    if (Math.random() > 0.8) variant.col = pickRandomKey('col');
    if (Math.random() > 0.8) variant.sleeve = pickRandomKey('sleeve');

    return variant;
}

function isValidCombo(params) {
    return !forbiddenCombos.some(combo =>
        Object.keys(combo).every(key => combo[key] === params[key])
    );
}

function describeVariant(params, index) {
    return `#${index} — ${labelFor('shoulder', params.shoulder)} | ${labelFor('col', params.col)} | ${labelFor('waist', params.waist)} | ${labelFor('length', params.length)} | ${labelFor('sleeve', params.sleeve)}`;
}

function labelFor(group, value) {
    return labelMap[group]?.[value] ?? value;
}

function generateSilhouettes() {
    const container = document.getElementById('canvasContainer');
    container.innerHTML = '';

    const baseParams = getCurrentParams();
    const variations = [];
    let attempts = 0;
    let valid = 0;
    let rejected = 0;

    while (valid < TARGET_SILHOUETTES && attempts < MAX_ATTEMPTS) {
        const candidate = mutateParams(baseParams, attempts);
        attempts++;

        if (!isValidCombo(candidate)) {
            rejected++;
            continue;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 600;
        drawSilhouette(canvas, candidate, valid);
        const description = describeVariant(candidate, valid + 1);
        canvas.title = description;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', description);
        container.appendChild(canvas);

        variations.push(candidate);
        valid++;
    }

    if (valid < TARGET_SILHOUETTES) {
        const fallback = fillWithFallbackCombos(baseParams, valid, container, variations);
        valid += fallback.added;
        attempts += fallback.tried;
        rejected += fallback.rejected;
        if (valid < TARGET_SILHOUETTES) {
            alert(`Seulement ${valid}/${TARGET_SILHOUETTES} silhouettes valides générées (règles trop restrictives).`);
        }
    }

    const info = document.getElementById('silhouetteInfo');
    info.hidden = false;
    updateInfo(baseParams, variations, { attempts, valid, rejected });
    createStatsChart({ attempts, valid, rejected });
}

function fillWithFallbackCombos(baseParams, startIndex, container, variations) {
    const keys = {
        shoulder: Object.keys(rules.shoulder),
        col: Object.keys(rules.col),
        waist: Object.keys(rules.waist),
        length: Object.keys(rules.length),
        sleeve: Object.keys(rules.sleeve)
    };

    let added = 0;
    let tried = 0;
    let rejected = 0;

    for (const shoulder of keys.shoulder) {
        for (const col of keys.col) {
            for (const waist of keys.waist) {
                for (const length of keys.length) {
                    for (const sleeve of keys.sleeve) {
                        if (startIndex + added >= TARGET_SILHOUETTES) {
                            return { added, tried, rejected };
                        }

                        const candidate = { shoulder, col, waist, length, sleeve };
                        tried++;

                        if (!isValidCombo(candidate)) {
                            rejected++;
                            continue;
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = 300;
                        canvas.height = 600;
                        drawSilhouette(canvas, candidate, startIndex + added);
                        const description = describeVariant(candidate, startIndex + added + 1);
                        canvas.title = description;
                        canvas.setAttribute('role', 'img');
                        canvas.setAttribute('aria-label', description);
                        container.appendChild(canvas);

                        variations.push(candidate);
                        added++;
                    }
                }
            }
        }
    }

    return { added, tried, rejected };
}

function createStatsChart(stats) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js non chargé, stats non rendues.');
        return;
    }

    const { attempts, valid, rejected } = stats;
    const remaining = Math.max(MAX_ATTEMPTS - attempts, 0);
    const container = document.getElementById('statsContainer');

    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'statsChart';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Diagramme des stats: ${valid} valides, ${rejected} rejetées, ${remaining} tentatives restantes`);
    container.appendChild(canvas);

    const previousChart = window.statsChart ?? Chart.getChart?.(canvas);
    if (previousChart && typeof previousChart.destroy === 'function') {
        previousChart.destroy();
    }

    window.statsChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Silhouettes valides', 'Combinaisons rejetées', 'Tentatives restantes'],
            datasets: [{
                data: [valid, rejected, remaining],
                backgroundColor: ['#ffd700', '#ff6b35', '#1a1a2e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f0f0f0', font: { family: 'serif' } } },
                title: {
                    display: true,
                    text: `Analyse: ${valid}/${TARGET_SILHOUETTES} valides — ${attempts}/${MAX_ATTEMPTS} essais`,
                    color: '#ffd700',
                    font: { size: 16, family: 'serif' }
                }
            }
        }
    });
}

function updateInfo(baseParams, variations, stats) {
    const configDetails = document.getElementById('configDetails');
    const { valid, rejected, attempts } = stats;

    const infoRows = [
        `<p><strong>Épaules :</strong> ${labelFor('shoulder', baseParams.shoulder)}</p>`,
        `<p><strong>Col :</strong> ${labelFor('col', baseParams.col)}</p>`,
        `<p><strong>Taille :</strong> ${labelFor('waist', baseParams.waist)}</p>`,
        `<p><strong>Longueur :</strong> ${labelFor('length', baseParams.length)}</p>`,
        `<p><strong>Manches :</strong> ${labelFor('sleeve', baseParams.sleeve)}</p>`
    ];

    const variationPreview = variations.length
        ? `Variations générées : ${variations
            .slice(0, 3)
            .map((v, idx) => describeVariant(v, idx + 1))
            .join(' · ')}${variations.length > 3 ? ' …' : ''}`
        : 'Aucune silhouette valide n’a été générée pour ces paramètres.';

    configDetails.innerHTML = `
        <div class="info-list">
            ${infoRows.join('')}
        </div>
        <p><strong>Statut :</strong> ${valid}/${TARGET_SILHOUETTES} valides — ${rejected} rejetées sur ${attempts} essais.</p>
        <p>${variationPreview}</p>
        <p style="margin-top:12px;font-style:italic;">${getStyleDescription(baseParams)}</p>
    `;
}

function getStyleDescription(params) {
    const desc = {
        shoulder: { sharp: 'Tension structurelle', volume: 'Volume architectural', fluid: 'Drapé organique' },
        col: { asym: 'Asymétrie audacieuse', vneck: 'Ligne épurée', oversize: 'Enveloppement généreux' }
    };
    return `${desc.shoulder[params.shoulder]} + ${desc.col[params.col]} : signature Ghesquière.`;
}

function exportPDF() {
    if (typeof html2pdf === 'undefined') {
        alert('La librairie html2pdf n’a pas pu être chargée.');
        return;
    }

    const element = document.getElementById('canvasContainer');
    if (!element.children.length) {
        alert('Générez des silhouettes avant d’exporter le lookbook.');
        return;
    }

    html2pdf()
        .set({
            margin: 1,
            filename: 'Silhouette_Engine_Ghesquiere_Lookbook.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        })
        .from(element)
        .save();
}

// Dessin de silhouette inspiré des réglages Ghesquière
function drawSilhouette(canvas, params, variation) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(10,10,20,0.95)');
    gradient.addColorStop(0.5, 'rgba(20,15,40,0.95)');
    gradient.addColorStop(1, 'rgba(50,20,80,0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,215,0,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < h; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
    }

    ctx.fillStyle = '#f8e4d8';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(w / 2, 55, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#e8c4a0';
    ctx.fillRect(w / 2 - 10, 87, 20, 20);

    const shoulder = rules.shoulder[params.shoulder];
    const col = rules.col[params.col];
    ctx.fillStyle = variation % 3 === 0 ? '#1a1a2e' : variation % 3 === 1 ? '#0f3460' : '#2a1a4a';

    ctx.beginPath();
    ctx.moveTo(w / 2 - shoulder.w / 2 + col.x, 107 + col.y);
    ctx.lineTo(w / 2 + shoulder.w / 2 + col.x, 107 + col.y);
    ctx.quadraticCurveTo(w / 2 + shoulder.w / 2 + 25, 130, w / 2 + shoulder.w / 2 + 15, 145);
    ctx.quadraticCurveTo(w / 2 - shoulder.w / 2 - 25, 130, w / 2 - shoulder.w / 2 + col.x, 145);
    ctx.closePath();
    ctx.fill();

    const waist = rules.waist[params.waist];
    ctx.fillStyle = '#2d1b69';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 55, 145);
    ctx.lineTo(w / 2 + 55, 145);
    ctx.quadraticCurveTo(w / 2 + 45, waist.y, w / 2 + 50, waist.y + 15);
    ctx.quadraticCurveTo(w / 2 - 45, waist.y + 20, w / 2 - 55, waist.y + 10);
    ctx.closePath();
    ctx.fill();

    const len = rules.length[params.length];
    ctx.fillStyle = variation % 4 === 0 ? '#4a2a6a' : '#3a1a5a';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 65, waist.y);
    ctx.lineTo(w / 2 + 65, waist.y);
    ctx.quadraticCurveTo(w / 2 + 75 + variation * 1.5, waist.y + len * 0.6, w / 2 + 55, waist.y + len);
    ctx.quadraticCurveTo(w / 2 - 55, waist.y + len - 20, w / 2 - 65, waist.y + len);
    ctx.closePath();
    ctx.fill();

    rules.sleeve[params.sleeve].forEach(sleeve => {
        ctx.fillStyle = '#1f1f3f';
        ctx.beginPath();
        ctx.moveTo(sleeve.x, 145);
        ctx.lineTo(sleeve.x + sleeve.w, 145);
        ctx.quadraticCurveTo(sleeve.x + sleeve.w + 10, sleeve.y + sleeve.h * 0.3, sleeve.x + sleeve.w / 2, sleeve.y + sleeve.h);
        ctx.quadraticCurveTo(sleeve.x - 10, sleeve.y + sleeve.h * 0.3, sleeve.x, 145);
        ctx.fill();
    });

    if (params.col === 'asym') {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(w - 35, h - 120);
        ctx.lineTo(w - 15, h - 120);
        ctx.lineTo(w - 20, h - 60);
        ctx.fill();
    }

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`#${variation + 1}`, w / 2, h - 15);

    ctx.fillStyle = 'rgba(255,215,0,0.8)';
    ctx.font = '14px monospace';
    ctx.fillText(`${params.shoulder[0].toUpperCase()}${params.col[0].toUpperCase()}`, 20, 25);
}

console.log('Silhouette Engine prêt — règles, stats et export PDF actifs.');
