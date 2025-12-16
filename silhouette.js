const TARGET_SILHOUETTES = 10;
const MAX_ATTEMPTS = 60;

const rules = {
  shoulder: {
    sharp: { w: 90, h: 16 },      // épaule droite
    volume: { w: 180, h: 50 },    // power-shoulder
    fluid: { w: 70, h: 28 }       // tombant
  },
  col: {
    asym: { x: 12, y: 8, drop: 40 },
    vneck: { x: 0, y: 0, depth: 40 },
    oversize: { x: -8, y: -8, expand: 24 }
  },
  waist: {
    high: { y: 115 },
    low: { y: 185 },
    marked: { y: 145, curve: 18, belt: true }
  },
  length: { mini: 140, midi: 280, maxi: 440 },
  sleeve: {
    none: [],
    short: [{ x: 38, y: 145, w: 36, h: 80 }],
    long: [{ x: 32, y: 145, w: 30, h: 230 }]
  }
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
  const map = labelMap[group];
  return map && map[value] ? map[value] : value;
}

function generateSilhouettes() {
  const container = document.getElementById('canvasContainer');
  container.innerHTML = '';

  const baseParams = getCurrentParams();
  const variations = [];
  const seen = new Set();

  let attempts = 0;
  let valid = 0;
  let rejected = 0;

  while (valid < TARGET_SILHOUETTES && attempts < MAX_ATTEMPTS) {
    const candidate = mutateParams(baseParams, attempts);
    attempts++;

    const key = `${candidate.shoulder}-${candidate.col}-${candidate.waist}-${candidate.length}-${candidate.sleeve}`;

    if (!isValidCombo(candidate) || seen.has(key)) {
      rejected++;
      continue;
    }

    seen.add(key);

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
    const fallback = fillWithFallbackCombos(baseParams, valid, container, variations, seen);
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

function fillWithFallbackCombos(baseParams, startIndex, container, variations, seen) {
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
            const key = `${candidate.shoulder}-${candidate.col}-${candidate.waist}-${candidate.length}-${candidate.sleeve}`;

            tried++;

            if (!isValidCombo(candidate) || seen.has(key)) {
              rejected++;
              continue;
            }

            seen.add(key);

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
  canvas.setAttribute('aria-label', `Diagramme des stats : ${valid} valides, ${rejected} rejetées, ${remaining} tentatives restantes`);
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
          text: `Analyse : ${valid}/${TARGET_SILHOUETTES} valides — ${attempts}/${MAX_ATTEMPTS} essais`,
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

  let variationPreview = '';
  if (variations.length) {
    const items = variations.slice(0, 3).map((v, idx) => `<li>${describeVariant(v, idx + 1)}</li>`);
    if (variations.length > 3) {
      items.push('<li>…</li>');
    }
    variationPreview = `<p class="info-variations-title"><strong>Variations générées :</strong></p><ul class="variation-list">${items.join('')}</ul>`;
  } else {
    variationPreview = '<p>Aucune silhouette valide n’a été générée pour ces paramètres.</p>';
  }

  configDetails.innerHTML = `
    <div class="info-list">
      ${infoRows.join('')}
    </div>
    <p class="info-status"><strong>Statut :</strong> ${valid}/${TARGET_SILHOUETTES} valides — ${rejected} rejetées sur ${attempts} essais.</p>
    ${variationPreview}
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
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('La librairie jsPDF n’est pas disponible.');
    return;
  }

  const canvases = Array.from(document.querySelectorAll('#lookbook-wrapper canvas'));
  if (!canvases.length) {
    alert('Générez des silhouettes avant d’exporter le lookbook.');
    return;
  }

  const pdf = new window.jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2 - 10;

  canvases.forEach((canvas, idx) => {
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const ratio = canvas.height / canvas.width;

    let imgWidth = availableWidth;
    let imgHeight = imgWidth * ratio;

    if (imgHeight > availableHeight) {
      imgHeight = availableHeight;
      imgWidth = imgHeight / ratio;
    }

    const x = (pageWidth - imgWidth) / 2;
    const y = margin + 8 + (availableHeight - imgHeight) / 2;

    if (idx > 0) {
      pdf.addPage();
    }

    pdf.setFontSize(14);
    pdf.text(`Silhouette ${idx + 1}`, pageWidth / 2, margin, { align: 'center' });
    pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight, undefined, 'FAST');
  });

  pdf.save('Silhouette_Engine_Ghesquiere_Lookbook.pdf');
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

  const shoulderRule = rules.shoulder[params.shoulder];
  const colRule = rules.col[params.col];
  const shoulderWidth = shoulderRule.w + (colRule.expand || 0);
  const shoulderHeight = shoulderRule.h + (colRule.expand ? 8 : 0);
  const topY = 108 + (colRule.y || 0);
  ctx.fillStyle = variation % 3 === 0 ? '#1a1a2e' : variation % 3 === 1 ? '#0f3460' : '#2a1a4a';

  ctx.beginPath();
  if (params.shoulder === 'sharp') {
    ctx.moveTo(w / 2 - shoulderWidth / 2, topY);
    ctx.lineTo(w / 2 + shoulderWidth / 2, topY);
    ctx.lineTo(w / 2 + shoulderWidth / 2 - 10, topY + shoulderHeight);
    ctx.lineTo(w / 2 - shoulderWidth / 2 + 10, topY + shoulderHeight);
  } else if (params.shoulder === 'volume') {
    ctx.moveTo(w / 2 - shoulderWidth / 2 - 10, topY);
    ctx.lineTo(w / 2 + shoulderWidth / 2 + 10, topY);
    ctx.quadraticCurveTo(w / 2 + shoulderWidth / 2 + 32, topY + shoulderHeight * 0.8, w / 2 + shoulderWidth / 2 + 16, topY + shoulderHeight + 18);
    ctx.lineTo(w / 2 - shoulderWidth / 2 - 16, topY + shoulderHeight + 18);
    ctx.quadraticCurveTo(w / 2 - shoulderWidth / 2 - 32, topY + shoulderHeight * 0.8, w / 2 - shoulderWidth / 2 - 10, topY);
  } else {
    ctx.moveTo(w / 2 - shoulderWidth / 2, topY);
    ctx.quadraticCurveTo(w / 2 - shoulderWidth / 2 - 12, topY + shoulderHeight, w / 2 - shoulderWidth / 2 + 6, topY + shoulderHeight + 24);
    ctx.quadraticCurveTo(w / 2, topY + shoulderHeight + 36, w / 2 + shoulderWidth / 2 - 6, topY + shoulderHeight + 24);
    ctx.quadraticCurveTo(w / 2 + shoulderWidth / 2 + 12, topY + shoulderHeight, w / 2 + shoulderWidth / 2, topY);
  }
  ctx.closePath();
  ctx.fill();

  const waist = rules.waist[params.waist];
  const waistY = waist.y;
  ctx.fillStyle = '#2d1b69';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 60, topY + shoulderHeight + 8);
  ctx.lineTo(w / 2 + 60, topY + shoulderHeight + 8);
  ctx.quadraticCurveTo(w / 2 + 55, waistY, w / 2 + 62, waistY + 18);
  ctx.quadraticCurveTo(w / 2 - 55, waistY + 22, w / 2 - 62, waistY + 10);
  ctx.closePath();
  ctx.fill();

  if (waist.belt) {
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(w / 2 - 70, waistY - 6, 140, 12);
  }

  const len = rules.length[params.length];
  const asymDrop = params.col === 'asym' ? (colRule.drop || 0) : 0;
  const leftDrop = params.col === 'asym' ? -asymDrop : 0;
  const rightLift = params.col === 'asym' ? asymDrop : 0;
  ctx.fillStyle = variation % 4 === 0 ? '#4a2a6a' : '#3a1a5a';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 70, waistY);
  ctx.lineTo(w / 2 + 70, waistY);
  ctx.quadraticCurveTo(w / 2 + 85, waistY + len * 0.55 + rightLift, w / 2 + 60, waistY + len + rightLift);
  ctx.quadraticCurveTo(w / 2 - 60, waistY + len - 25 + leftDrop, w / 2 - 70, waistY + len + leftDrop);
  ctx.closePath();
  ctx.fill();

  if (params.col === 'asym') {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(w - 40, waistY + len * 0.5);
    ctx.lineTo(w - 18, waistY + len * 0.5 + 45);
    ctx.lineTo(w - 28, waistY + len * 0.5 + 90);
    ctx.fill();
  }

  if (params.col === 'vneck') {
    ctx.save();
    ctx.fillStyle = '#0a0a15';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, topY + 6);
    ctx.lineTo(w / 2 + 20, topY + 6);
    ctx.lineTo(w / 2, topY + (rules.col.vneck.depth || 40) + 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  if (params.col === 'oversize') {
    ctx.fillStyle = 'rgba(255,215,0,0.15)';
    ctx.fillRect(w / 2 - shoulderWidth / 2 - 10, topY - 6, shoulderWidth + 20, shoulderHeight + 18);
  }

  if (params.sleeve !== 'none') {
    const baseSleeve = rules.sleeve[params.sleeve][0];
    const startY = topY + shoulderHeight * 0.6;
    const sleeveHeight = params.sleeve === 'short'
      ? baseSleeve.h
      : Math.max(baseSleeve.h, len * 0.55);
    const sleeveWidth = baseSleeve.w;
    const colors = { short: '#22304f', long: '#16203f' };
    const color = colors[params.sleeve] || '#1f1f3f';
    const offset = shoulderWidth / 2 + 10;

    drawSleeve(w / 2 - offset - sleeveWidth, startY, sleeveWidth, sleeveHeight, color);
    drawSleeve(w / 2 + offset, startY, sleeveWidth, sleeveHeight, color);
  }

  function drawSleeve(x, y, sw, sh, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sw, y);
    ctx.quadraticCurveTo(x + sw + 8, y + sh * 0.25, x + sw * 0.5, y + sh);
    ctx.quadraticCurveTo(x - 8, y + sh * 0.25, x, y);
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
