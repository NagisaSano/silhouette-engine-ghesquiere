// Fix: restored DOM wiring and parameter helpers so generation runs again.

const TARGET_SILHOUETTES = 10;
const MAX_ATTEMPTS = 60;

let generationSeed = Date.now(); // Seed initial pour variations visuelles

const DEFAULT_PARAMS = {
  shoulder: 'sharp',
  col: 'asym',
  waist: 'high',
  length: 'midi',
  sleeve: 'none'
};

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
  const generateBtn = document.getElementById('generateBtn');
  const exportBtn = document.getElementById('exportBtn');

  if (generateBtn) {
    generateBtn.addEventListener('click', generateSilhouettes);
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', exportPDF);
  }

  generateSilhouettes();
});

function getCurrentParams() {
  // Reads current user selection from dropdowns.
  const safeValue = (id, fallback) => {
    const el = document.getElementById(id);
    return el && el.value ? el.value : fallback;
  };

  return {
    shoulder: safeValue('shoulderSelect', DEFAULT_PARAMS.shoulder),
    col: safeValue('colSelect', DEFAULT_PARAMS.col),
    waist: safeValue('waistSelect', DEFAULT_PARAMS.waist),
    length: safeValue('lengthSelect', DEFAULT_PARAMS.length),
    sleeve: safeValue('sleeveSelect', DEFAULT_PARAMS.sleeve)
  };
}


function renderVariationsList(variations) {
  if (!variations.length) {
    return "<p>Aucune silhouette valide n'a ete generee pour ces parametres.</p>";
  }

  const items = variations.slice(0, 3).map((v, idx) => `<li>${describeVariant(v, idx + 1)}</li>`);
  if (variations.length > 3) {
    items.push('<li>...</li>');
  }

  return `
    <p class="info-variations-title"><strong>Variations generees :</strong></p>
    <ul class="variation-list">
      ${items.join('')}
    </ul>
  `;
}

function isValidCombo(params) {
  return !forbiddenCombos.some(combo =>
    Object.keys(combo).every(key => combo[key] === params[key])
  );
}


function describeVariant(params, index) {
  return `#${index} ? ${labelFor('shoulder', params.shoulder)} | ${labelFor('col', params.col)} | ${labelFor('waist', params.waist)} | ${labelFor('length', params.length)} | ${labelFor('sleeve', params.sleeve)}`;
}

function labelFor(group, value) {
  const map = labelMap[group];
  return map && map[value] ? map[value] : value;
}

function generateSilhouettes() {
  generationSeed = Date.now(); // Nouveau seed à chaque génération
  const container = document.getElementById('canvasContainer');
  if (!container) return;
  container.innerHTML = '';

  const baseParams = getCurrentParams();
  const variations = [];

  if (!isValidCombo(baseParams)) {
    alert('Configuration interdite par les règles (forbiddenCombos). Modifiez vos choix.');
    return;
  }

  for (let i = 0; i < TARGET_SILHOUETTES; i++) {
    const candidate = { ...baseParams };

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 600;
    drawSilhouette(canvas, candidate, i);
    const description = describeVariant(candidate, i + 1);
    canvas.title = description;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', description);
    container.appendChild(canvas);

    variations.push(candidate);
  }

  const valid = variations.length;
  const attempts = TARGET_SILHOUETTES;
  const rejected = 0;

  const info = document.getElementById('silhouetteInfo');
  info.hidden = false;
  updateInfo(baseParams, variations, { attempts, valid, rejected });
  createStatsChart({ attempts, valid, rejected });
}


function createStatsChart(stats) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js non charge, stats non rendues.');
    return;
  }

  const { attempts, valid, rejected } = stats;
  const remaining = Math.max(MAX_ATTEMPTS - attempts, 0);
  const container = document.getElementById('statsContainer');

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.id = 'statsChart';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Diagramme des stats : ${valid} valides, ${rejected} rejetees, ${remaining} tentatives restantes`);
  container.appendChild(canvas);

  const previousChart = window.statsChart || (Chart.getChart && Chart.getChart(canvas));
  if (previousChart && typeof previousChart.destroy === 'function') {
    previousChart.destroy();
  }

  window.statsChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Silhouettes valides', 'Combinaisons rejetees', 'Tentatives restantes'],
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
          text: `Analyse : ${valid}/${TARGET_SILHOUETTES} valides ... ${attempts}/${MAX_ATTEMPTS} essais`,
          color: '#ffd700',
          font: { size: 16, family: 'serif' }
        }
      }
    }
  });

  const desc = document.createElement('p');
  desc.className = 'stats-desc';
  desc.textContent = `Statistiques : ${valid} valides, ${rejected} rejetees, ${remaining} tentatives restantes.`;
  container.appendChild(desc);
}

function updateInfo(baseParams, variations, stats) {
  const configDetails = document.getElementById('configDetails');
  const { valid, rejected, attempts } = stats;

  const infoRows = [
    `<p><strong>Epaules :</strong> ${labelFor('shoulder', baseParams.shoulder)}</p>`,
    `<p><strong>Col :</strong> ${labelFor('col', baseParams.col)}</p>`,
    `<p><strong>Taille :</strong> ${labelFor('waist', baseParams.waist)}</p>`,
    `<p><strong>Longueur :</strong> ${labelFor('length', baseParams.length)}</p>`,
    `<p><strong>Manches :</strong> ${labelFor('sleeve', baseParams.sleeve)}</p>`
  ];

  const variationPreview = renderVariationsList(variations);

  configDetails.innerHTML = `
    <div class="info-list">
      ${infoRows.join('')}
    </div>
    <p class="info-status"><strong>Statut :</strong> ${valid}/${TARGET_SILHOUETTES} valides ... ${rejected} rejetees sur ${attempts} essais.</p>
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
  const visualVariations = {
    paletteIndex: (variation + Math.floor(generationSeed / 1000)) % 4,
    shoulderWidthDelta: ((variation * 7 + generationSeed % 100) % 50) - 25,
    shoulderHeightDelta: ((variation * 5 + generationSeed % 80) % 16) - 8,
    waistYDelta: ((variation * 11 + generationSeed % 60) % 20) - 10,
    lengthDelta: ((variation * 13 + generationSeed % 120) % 40) - 20,
    skirtType: (variation + Math.floor(generationSeed / 500)) % 4,
    bustWidth: 60 + ((variation * 3 + generationSeed % 40) % 20) - 10,
    asymIntensity: 1 + ((variation + generationSeed % 30) % 3) * 0.5,
    sleeveHeightMultiplier: 0.9 + ((variation + generationSeed % 50) % 5) * 0.1,
    beltThicknessDelta: (variation % 3) * 2
  };

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const shoulderRule = rules.shoulder[params.shoulder];
  const colRule = rules.col[params.col];

  drawBackgroundAndHead();
  const shoulderMetrics = drawShoulders(shoulderRule, colRule);
  const { waistY, len } = drawTorsoAndSkirt(colRule, shoulderMetrics);
  drawSleeves(shoulderMetrics, len);
  drawFrameAndLabels();

  function drawBackgroundAndHead() {
    const gradients = [
      ['rgba(10,10,20,0.95)', 'rgba(20,15,40,0.95)', 'rgba(50,20,80,0.95)'],
      ['rgba(12,8,24,0.95)', 'rgba(18,18,48,0.95)', 'rgba(42,26,70,0.95)'],
      ['rgba(8,8,18,0.95)', 'rgba(16,20,44,0.95)', 'rgba(36,24,64,0.95)'],
      ['rgba(14,10,30,0.95)', 'rgba(22,18,52,0.95)', 'rgba(60,28,70,0.95)']
    ];
    const palette = gradients[visualVariations.paletteIndex];
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.5, palette[1]);
    gradient.addColorStop(1, palette[2]);
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
  }

  function drawShoulders(shoulder, col) {
    const baseWidth = shoulder.w + (col.expand || 0);
    const widthVariation = (variation % 5) * 15; // 0, 15, 30, 45, 60
    const shoulderWidth = baseWidth + widthVariation - 30 + visualVariations.shoulderWidthDelta;

    const baseHeight = shoulder.h + (col.expand ? 8 : 0);
    const heightVariation = (variation % 4) * 6; // 0, 6, 12, 18
    const shoulderHeight = baseHeight + heightVariation - 9 + visualVariations.shoulderHeightDelta;

    const topY = 108 + (col.y || 0) + (variation % 3 - 1) * 4;
    ctx.fillStyle = variation % 3 === 0 ? '#1a1a2e' : variation % 3 === 1 ? '#0f3460' : '#2a1a4a';

    ctx.beginPath();
    if (params.shoulder === 'sharp') {
      const angleOffset = 8 + (variation % 4) * 3;
      ctx.moveTo(w / 2 - shoulderWidth / 2, topY);
      ctx.lineTo(w / 2 + shoulderWidth / 2, topY);
      ctx.lineTo(w / 2 + shoulderWidth / 2 - angleOffset, topY + shoulderHeight);
      ctx.lineTo(w / 2 - shoulderWidth / 2 + angleOffset, topY + shoulderHeight);
    } else if (params.shoulder === 'volume') {
      const amp = 0.8 + (variation % 4) * 0.25;
      ctx.moveTo(w / 2 - shoulderWidth / 2 - 14, topY);
      ctx.lineTo(w / 2 + shoulderWidth / 2 + 14, topY);
      ctx.quadraticCurveTo(w / 2 + shoulderWidth / 2 + 36, topY + shoulderHeight * amp, w / 2 + shoulderWidth / 2 + 18, topY + shoulderHeight + 22);
      ctx.lineTo(w / 2 - shoulderWidth / 2 - 18, topY + shoulderHeight + 22);
      ctx.quadraticCurveTo(w / 2 - shoulderWidth / 2 - 36, topY + shoulderHeight * amp, w / 2 - shoulderWidth / 2 - 14, topY);
    } else {
      const fluidDepth = shoulderHeight + 24 + (variation % 4) * 6;
      ctx.moveTo(w / 2 - shoulderWidth / 2, topY);
      ctx.quadraticCurveTo(w / 2 - shoulderWidth / 2 - 14, topY + shoulderHeight, w / 2 - shoulderWidth / 2 + 8, topY + fluidDepth);
      ctx.quadraticCurveTo(w / 2, topY + fluidDepth + 10, w / 2 + shoulderWidth / 2 - 8, topY + fluidDepth);
      ctx.quadraticCurveTo(w / 2 + shoulderWidth / 2 + 14, topY + shoulderHeight, w / 2 + shoulderWidth / 2, topY);
    }
    ctx.closePath();
    ctx.fill();

    return { shoulderWidth, shoulderHeight, topY };
  }

  function drawTorsoAndSkirt(col, shoulderMetrics) {
    const waist = rules.waist[params.waist];
    const waistY = waist.y + visualVariations.waistYDelta;
    const torsoWidth = visualVariations.bustWidth;
    const hipWidth = torsoWidth + 20 + (variation % 4) * 5;
    ctx.fillStyle = '#2d1b69';
    ctx.beginPath();
    ctx.moveTo(w / 2 - torsoWidth, shoulderMetrics.topY + shoulderMetrics.shoulderHeight + 8);
    ctx.lineTo(w / 2 + torsoWidth, shoulderMetrics.topY + shoulderMetrics.shoulderHeight + 8);
    ctx.quadraticCurveTo(w / 2 + hipWidth * 0.9, waistY, w / 2 + hipWidth, waistY + 18);
    ctx.quadraticCurveTo(w / 2 - hipWidth, waistY + 22, w / 2 - hipWidth * 0.9, waistY + 10);
    ctx.closePath();
    ctx.fill();

    if (waist.belt) {
      ctx.fillStyle = '#ffd700';
      const beltThickness = 10 + visualVariations.beltThicknessDelta;
      ctx.fillRect(w / 2 - hipWidth, waistY - beltThickness / 2, hipWidth * 2, beltThickness);
    }

    const lengthBase = rules.length[params.length];
    const len = lengthBase + visualVariations.lengthDelta;
    const asymDropBase = params.col === 'asym' ? (col.drop || 0) : 0;
    const asymDrop = params.col === 'asym' ? asymDropBase * visualVariations.asymIntensity : 0;
    const leftDrop = params.col === 'asym' ? -asymDrop : 0;
    const rightLift = params.col === 'asym' ? asymDrop : 0;
    ctx.fillStyle = variation % 4 === 0 ? '#4a2a6a' : '#3a1a5a';
    ctx.beginPath();
    const skirtWidth = hipWidth + 10 + (variation % 3) * 6;
    ctx.moveTo(w / 2 - skirtWidth, waistY);
    ctx.lineTo(w / 2 + skirtWidth, waistY);

    const skirtType = visualVariations.skirtType;
    if (skirtType === 0) {
      ctx.quadraticCurveTo(w / 2 + skirtWidth + 15, waistY + len * 0.55 + rightLift, w / 2 + skirtWidth - 10, waistY + len + rightLift);
      ctx.quadraticCurveTo(w / 2 - skirtWidth + 10, waistY + len - 25 + leftDrop, w / 2 - skirtWidth, waistY + len + leftDrop);
    } else if (skirtType === 1) {
      ctx.quadraticCurveTo(w / 2 + skirtWidth + 30, waistY + len * 0.6 + rightLift, w / 2 + skirtWidth + 5, waistY + len + rightLift + 20);
      ctx.quadraticCurveTo(w / 2 - skirtWidth - 5, waistY + len - 15 + leftDrop, w / 2 - skirtWidth - 30, waistY + len + leftDrop + 10);
    } else if (skirtType === 2) {
      const strongAsymDrop = params.col === 'asym' ? 60 : 20;
      ctx.quadraticCurveTo(w / 2 + skirtWidth + 20, waistY + len * 0.5 + strongAsymDrop, w / 2 + skirtWidth - 5, waistY + len + strongAsymDrop);
      ctx.quadraticCurveTo(w / 2 - skirtWidth + 5, waistY + len - 35 - strongAsymDrop, w / 2 - skirtWidth - 20, waistY + len - strongAsymDrop);
    } else {
      ctx.quadraticCurveTo(w / 2 + skirtWidth * 0.6, waistY + len * 0.55 + rightLift, w / 2 + skirtWidth * 0.5, waistY + len + rightLift - 10);
      ctx.quadraticCurveTo(w / 2 - skirtWidth * 0.5, waistY + len - 30 + leftDrop, w / 2 - skirtWidth * 0.6, waistY + len + leftDrop - 5);
    }
    ctx.closePath();
    ctx.fill();

    if (params.col === 'asym') {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      const asymPositions = [waistY + len * 0.25, waistY + len * 0.5, waistY + len * 0.75];
      const asymIdx = variation % asymPositions.length;
      const baseX = w - 40 + (variation % 5 - 2) * 3;
      const startY = asymPositions[asymIdx];
      ctx.moveTo(baseX, startY);
      ctx.lineTo(baseX + 22, startY + 45);
      ctx.lineTo(baseX + 12, startY + 90);
      ctx.fill();
    }

    if (params.col === 'vneck') {
      ctx.save();
      ctx.fillStyle = '#0a0a15';
      ctx.beginPath();
      ctx.moveTo(w / 2 - 20, shoulderMetrics.topY + 6);
      ctx.lineTo(w / 2 + 20, shoulderMetrics.topY + 6);
      ctx.lineTo(w / 2, shoulderMetrics.topY + (rules.col.vneck.depth || 40) + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    if (params.col === 'oversize') {
      ctx.fillStyle = 'rgba(255,215,0,0.15)';
      ctx.fillRect(w / 2 - shoulderMetrics.shoulderWidth / 2 - 10, shoulderMetrics.topY - 6, shoulderMetrics.shoulderWidth + 20, shoulderMetrics.shoulderHeight + 18);
    }

    return { waistY, len };
  }

  function drawSleeves(shoulderMetrics, len) {
    if (params.sleeve === 'none') return;

    const sleeveConfig = rules.sleeve[params.sleeve];
    if (!sleeveConfig || !sleeveConfig[0]) return;

    const baseSleeve = sleeveConfig[0];
    const startY = shoulderMetrics.topY + shoulderMetrics.shoulderHeight * 0.6;
    const heightBase = params.sleeve === 'short' ? 80 : baseSleeve.h;
    const rawHeight = heightBase * visualVariations.sleeveHeightMultiplier;
    const sleeveHeight = params.sleeve === 'short'
      ? Math.min(90, Math.max(70, rawHeight))
      : Math.min(250, Math.max(200, rawHeight));
    const sleeveWidth = baseSleeve.w + (variation % 3 - 1) * 6;
    const colors = { short: '#22304f', long: '#16203f' };
    const color = colors[params.sleeve] || '#1f1f3f';
    const offset = shoulderMetrics.shoulderWidth / 2 + 10;

    renderSleeve(w / 2 - offset - sleeveWidth, startY, sleeveWidth, sleeveHeight, color);
    renderSleeve(w / 2 + offset, startY, sleeveWidth, sleeveHeight, color);

    function renderSleeve(x, y, sw, sh, fillColor) {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sw, y);
      ctx.quadraticCurveTo(x + sw + 8, y + sh * 0.25, x + sw * 0.5, y + sh);
      ctx.quadraticCurveTo(x - 8, y + sh * 0.25, x, y);
      ctx.fill();
    }
  }

  function drawFrameAndLabels() {
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
}

console.log('Silhouette Engine prêt — règles, stats et export PDF actifs.');
