const WEEKDAYS = [
  { key: 1, short: 'L', label: 'Lunes' },
  { key: 2, short: 'M', label: 'Martes' },
  { key: 3, short: 'X', label: 'Miércoles' },
  { key: 4, short: 'J', label: 'Jueves' },
  { key: 5, short: 'V', label: 'Viernes' },
  { key: 6, short: 'S', label: 'Sábado' },
  { key: 0, short: 'D', label: 'Domingo' }
];

const MOVEMENT_DEFINITIONS = [
  { key: 'ESTATUTARIO_INTERINO', label: 'ESTATUTARIO INTERINO', regex: /ESTATUTARIO\s+INTERINO/i, discountable: false },
  { key: 'INCORPORACION_ESTATUTARIO', label: 'INCORPORACION ESTATUTARIO', regex: /INCORPORACION\s+ESTATUTA(?:RIO|TIO|ATIO)|INCORPORACION\s+ESTATUTARIO/i, discountable: false },
  { key: 'PERMISO_NACIMIENTO', label: 'PERMISO NACIMIENTO', regex: /PERMISO\s+(?:DE\s+)?NACIMIENTO/i, discountable: false },
  { key: 'RIESGO_DURANTE_EL_EMBARAZO', label: 'RIESGO DURANTE EL EMBARAZO', regex: /RIESGO\s+DURANTE\s+EL\s+EMBARAZO/i, discountable: true },
  { key: 'ASUNTOS_PARTICULARES', label: 'ASUNTOS PARTICULARES (6)', regex: /ASUNTOS\s+PARTICULARES/i, discountable: true },
  { key: 'CURSOS_FORMACION_CONTINUADA', label: 'CURSOS\/FORMACION CONTINUADA', regex: /CURSOS?\s*\/\s*FORMACION\s+CONTINUADA|FORMACION\s+CONTINUADA/i, discountable: true },
  { key: 'HUELGA_TOTAL_DIAS', label: 'HUELGA TOTAL (DIAS)', regex: /HUELGA\s+TOTAL/i, discountable: true }
];

const OCR_HEADER_PATTERNS = [
  /TIPO\s+DE\s+MOVIMIENTO/i,
  /FECHA\s+INICIO/i,
  /FECHA\s+FIN/i,
  /^MOVIMIENTO$/i,
  /^INICIO$/i,
  /^FIN$/i
];

const MOVEMENT_DEFINITION_MAP = Object.fromEntries(MOVEMENT_DEFINITIONS.map(item => [item.key, item]));

const todayISO = new Date().toISOString().slice(0, 10);

const state = {
  form: {
    caseType: 'nacimiento',
    enjoymentMode: 'sms28',
    birthDate: '',
    leaveEndDate: '',
    contractStartDate: '',
    contractEndDate: '',
    lactationStartDate: '',
    asOfDate: todayISO,
    multipleChildren: 1,
    dailyHours: 7,
    excludedDatesText: '',
    alreadyUsedHours: 0,
    notes: '',
    workdays: [1, 2, 3, 4, 5]
  },
  excludedRanges: [],
  ocr: {
    rawText: '',
    previewUrl: '',
    records: [],
    allDates: [],
    processing: false,
    status: 'Esperando imagen.',
    statusType: 'muted'
  }
};

const el = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  bindTabs();
  bindFormInputs();
  bindActions();
  renderWorkdays();
  renderExcludedRanges();
  renderCalculations();
  renderOcr();
});

function cacheDom() {
  [
    'caseType', 'enjoymentMode', 'birthDate', 'leaveEndDate', 'contractStartDate', 'contractEndDate', 'lactationStartDate', 'asOfDate',
    'multipleChildren', 'dailyHours', 'excludedDatesText', 'alreadyUsedHours', 'notes',
    'workdays', 'excludedRanges', 'hourStats', 'smsStats', 'expedientSummary', 'resultSubtitle',
    'calcWarnings', 'addRangeBtn', 'ocrFileInput', 'ocrStatus', 'ocrPreviewWrap', 'ocrPreview',
    'ocrRawText', 'ocrDates', 'ocrSummaryStats', 'ocrTableWrap', 'applyOcrBtn'
  ].forEach(id => el[id] = document.getElementById(id));

  el.asOfDate.value = todayISO;
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
    });
  });
}

function bindFormInputs() {
  ['caseType', 'enjoymentMode', 'birthDate', 'leaveEndDate', 'contractStartDate', 'contractEndDate', 'lactationStartDate', 'asOfDate', 'excludedDatesText', 'notes']
    .forEach(id => el[id].addEventListener('input', () => updateForm(id, el[id].value)));

  ['multipleChildren', 'dailyHours', 'alreadyUsedHours']
    .forEach(id => el[id].addEventListener('input', () => updateForm(id, Number(el[id].value || 0))));
}

function bindActions() {
  el.addRangeBtn.addEventListener('click', () => {
    state.excludedRanges.push({ start: '', end: '', reason: '' });
    renderExcludedRanges();
    renderCalculations();
  });

  el.ocrFileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) await handleOcrFile(file);
  });

  el.applyOcrBtn.addEventListener('click', applyOcrToForm);
}

function updateForm(key, value) {
  state.form[key] = value;
  if (key === 'leaveEndDate') {
    if (value) {
      const next = addDays(toDate(value), 1);
      state.form.lactationStartDate = toISO(next);
      el.lactationStartDate.value = state.form.lactationStartDate;
    } else {
      state.form.lactationStartDate = '';
      el.lactationStartDate.value = '';
    }
  }
  renderCalculations();
  renderOcr();
}

function renderWorkdays() {
  el.workdays.innerHTML = '';
  WEEKDAYS.forEach(day => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `day-toggle ${state.form.workdays.includes(day.key) ? 'active' : ''}`;
    button.textContent = day.short;
    button.title = day.label;
    button.addEventListener('click', () => {
      if (state.form.workdays.includes(day.key)) {
        state.form.workdays = state.form.workdays.filter(d => d !== day.key);
      } else {
        state.form.workdays = [...state.form.workdays, day.key].sort((a, b) => [1,2,3,4,5,6,0].indexOf(a) - [1,2,3,4,5,6,0].indexOf(b));
      }
      renderWorkdays();
      renderCalculations();
      renderOcr();
    });
    el.workdays.appendChild(button);
  });
}

function renderExcludedRanges() {
  if (!state.excludedRanges.length) {
    el.excludedRanges.innerHTML = '<div class="status muted">No hay tramos añadidos.</div>';
    return;
  }

  el.excludedRanges.innerHTML = '';
  state.excludedRanges.forEach((range, index) => {
    const row = document.createElement('div');
    row.className = 'range-row';
    row.innerHTML = `
      <input type="date" value="${escapeAttr(range.start)}" />
      <input type="date" value="${escapeAttr(range.end)}" />
      <input type="text" value="${escapeAttr(range.reason)}" placeholder="Motivo" />
      <button type="button" class="delete-btn">🗑</button>
    `;

    const [start, end, reason, del] = row.querySelectorAll('input, button');
    start.addEventListener('input', () => { state.excludedRanges[index].start = start.value; renderCalculations(); });
    end.addEventListener('input', () => { state.excludedRanges[index].end = end.value; renderCalculations(); });
    reason.addEventListener('input', () => { state.excludedRanges[index].reason = reason.value; });
    del.addEventListener('click', () => {
      state.excludedRanges.splice(index, 1);
      renderExcludedRanges();
      renderCalculations();
    });
    el.excludedRanges.appendChild(row);
  });
}

function renderCalculations() {
  const hourResult = computeHourEngine();
  const smsResult = computeSms28Engine();

  el.calcWarnings.innerHTML = '';
  if (!hourResult.valid) {
    el.calcWarnings.innerHTML = `<div class="notice warn">${hourResult.reason}</div>`;
    el.resultSubtitle.textContent = 'Introduce al menos la fecha causante.';
    el.hourStats.innerHTML = '';
    el.smsStats.innerHTML = '';
    el.expedientSummary.innerHTML = `<p><strong>Situación:</strong> ${escapeHtml(labelizeCase(state.form.caseType))}</p>`;
    return;
  }

  const notices = [];
  if (hourResult.adjustedStartByBirth) notices.push('La fecha de inicio real del disfrute es anterior a la fecha causante; se usa la fecha causante como inicio efectivo.');
  if (hourResult.adjustedStartByContract) notices.push('La fecha de inicio real del disfrute es anterior al inicio del contrato; se usa la fecha de inicio de contrato como inicio efectivo.');
  if (hourResult.limitedByContract) notices.push('El cálculo se ha limitado por la fecha fin de contrato.');
  if (hourResult.noAvailabilityReason) notices.push(hourResult.noAvailabilityReason);
  el.calcWarnings.innerHTML = notices.map(text => `<div class="notice info">${escapeHtml(text)}</div>`).join('');

  el.resultSubtitle.textContent = hourResult.limitedByContract
    ? `Fin efectivo del cálculo: ${formatDate(hourResult.effectiveLastEntitlementDay)} (limitado por fin de contrato)`
    : `Fin efectivo del cálculo: ${formatDate(hourResult.effectiveLastEntitlementDay)}`;

  el.hourStats.innerHTML = `
    <div class="results-combined">
      <div class="results-top">
        ${statHtml('Jornadas completas Lactancia', `${hourResult.wholeDays}`, `+ ${formatNumber(hourResult.remainderHours)} h restantes`, 'featured')}
        ${statHtml('Fin previsto SMS', smsResult.projectedEnd ? formatDate(smsResult.projectedEnd) : '—', smsResult.projectedEnd ? (smsResult.limitedByContract ? 'Limitado por contrato' : 'Dentro del periodo disponible') : 'Solo si se conoce la fecha de inicio')}
      </div>
      <div class="results-divider"></div>
      <div class="results-bottom">
        ${statHtml('Horas totales', `${formatNumber(hourResult.totalHours)} h`, `${hourResult.totalEligibleWorkdays} días laborables computables`)}
        ${statHtml('Horas pendientes', `${formatNumber(hourResult.remainingHours)} h`, `${formatNumber(hourResult.eqDays)} jornadas equivalentes`)}
        ${statHtml('Jornadas consumidas', `${formatNumber(hourResult.consumedEqDays)}`, `${hourResult.consumedEligibleWorkdays} días laborables ya transcurridos`)}
        ${statHtml('Horas consumidas', `${formatNumber(hourResult.consumedHours)} h`, 'Consumo acumulado hasta la fecha de consulta')}
      </div>
    </div>
  `;
  el.smsStats.innerHTML = '';

  el.expedientSummary.innerHTML = `
    <p><strong>Situación:</strong> ${escapeHtml(labelizeCase(state.form.caseType))}</p>
    <p><strong>Nº de Jornadas Lactancia:</strong> ${escapeHtml(String(hourResult.wholeDays))} &nbsp;&nbsp; <strong>Saldo por horas:</strong> ${escapeHtml(`${formatNumber(hourResult.remainingHours)} h`)}</p>
    <p><strong>Fecha causante:</strong> ${escapeHtml(formatDate(state.form.birthDate))}</p>
    <p><strong>Inicio contrato:</strong> ${escapeHtml(formatDate(state.form.contractStartDate))}</p>
    <p><strong>Fin contrato:</strong> ${escapeHtml(formatDate(state.form.contractEndDate || state.form.asOfDate || todayISO))}${state.form.contractEndDate ? '' : ' <em>(contrato abierto)</em>'}</p>
    <p><strong>Inicio real del disfrute:</strong> ${escapeHtml(formatDate(state.form.lactationStartDate))}</p>
    <p><strong>Inicio efectivo del cálculo:</strong> ${escapeHtml(formatDate(hourResult.calcFrom))}</p>
    <p><strong>Fin por edad del menor:</strong> ${escapeHtml(formatDate(hourResult.lastEntitlementDay))}</p>
    <p><strong>Fin efectivo del cálculo:</strong> ${escapeHtml(formatDate(hourResult.effectiveLastEntitlementDay))}${hourResult.limitedByContract ? ' <em>(limitado por contrato)</em>' : ''}</p>
    <p><strong>Saldo acumulado SMS:</strong> ${escapeHtml(`${formatNumber(smsResult.remainingNaturalDays)} días naturales`)}</p>
  `;
}

function statHtml(label, value, sub, extraClass = '') {
  return `
    <article class="stat ${escapeHtml(extraClass)}">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="sub">${escapeHtml(sub)}</div>
    </article>
  `;
}

function computeHourEngine() {
  const {
    birthDate,
    leaveEndDate,
    contractStartDate,
    contractEndDate,
    lactationStartDate,
    asOfDate,
    multipleChildren,
    dailyHours,
    workdays,
    alreadyUsedHours,
    excludedDatesText
  } = state.form;

  if (!birthDate) return { valid: false, reason: 'Falta la fecha del nacimiento, adopción o acogimiento.' };

  const turns12 = addMonthsISO(birthDate, 12);
  const lastEntitlementDay = toISO(addDays(toDate(turns12), -1));
  const theoreticalStart = lactationStartDate || (leaveEndDate ? toISO(addDays(toDate(leaveEndDate), 1)) : birthDate);
  const calcFrom = maxDateIso(theoreticalStart, birthDate, contractStartDate || '');
  const contractEndExclusive = contractEndDate ? toISO(addDays(toDate(contractEndDate), 1)) : '';
  const effectiveWindowEndExclusive = minDateIso(turns12, contractEndExclusive || turns12);
  const effectiveLastEntitlementDay = effectiveWindowEndExclusive ? toISO(addDays(toDate(effectiveWindowEndExclusive), -1)) : '';
  const isolatedExcluded = parseExcludedDates(excludedDatesText);
  const hourFactor = Math.max(1, Number(multipleChildren) || 1);
  const calcFromDate = toDate(calcFrom);
  const windowEndDate = toDate(effectiveWindowEndExclusive);
  const hasWindow = calcFromDate && windowEndDate && calcFromDate < windowEndDate;

  const allEligibleDays = hasWindow ? eachDay(calcFrom, effectiveWindowEndExclusive).filter(iso => {
    const weekday = toDate(iso).getDay();
    return workdays.includes(weekday) && !isolatedExcluded.includes(iso) && !isExcludedByRanges(iso, state.excludedRanges);
  }) : [];

  const consumedUntilExclusive = hasWindow ? minDateIso(asOfDate || todayISO, effectiveWindowEndExclusive) : '';
  const consumedEligibleDays = hasWindow ? eachDay(calcFrom, consumedUntilExclusive).filter(iso => {
    const weekday = toDate(iso).getDay();
    return workdays.includes(weekday) && !isolatedExcluded.includes(iso) && !isExcludedByRanges(iso, state.excludedRanges);
  }) : [];

  const totalHours = round2(allEligibleDays.length * hourFactor);
  const consumedHoursByCalendar = round2(consumedEligibleDays.length * hourFactor);
  const consumedHours = Math.min(totalHours, Math.max(consumedHoursByCalendar, Number(alreadyUsedHours) || 0));
  const remainingHours = Math.max(0, round2(totalHours - consumedHours));
  const eqDays = dailyHours > 0 ? round2(remainingHours / dailyHours) : 0;
  const wholeDays = dailyHours > 0 ? Math.floor(remainingHours / dailyHours) : 0;
  const remainderHours = dailyHours > 0 ? round2(remainingHours - wholeDays * dailyHours) : 0;
  const consumedEqDays = dailyHours > 0 ? round2(consumedHours / dailyHours) : 0;

  let noAvailabilityReason = '';
  if (!hasWindow) {
    if (contractEndDate && calcFromDate && toDate(contractEndDate) && calcFromDate > toDate(contractEndDate)) {
      noAvailabilityReason = 'La fecha de inicio real del disfrute es posterior a la fecha fin de contrato.';
    } else if (effectiveLastEntitlementDay && calcFromDate && calcFromDate > toDate(effectiveLastEntitlementDay)) {
      noAvailabilityReason = 'La fecha de inicio real del disfrute queda fuera del periodo de disfrute disponible.';
    }
  }

  return {
    valid: true,
    turns12,
    calcFrom,
    lastEntitlementDay,
    effectiveLastEntitlementDay,
    limitedByContract: Boolean(contractEndDate && effectiveLastEntitlementDay && effectiveLastEntitlementDay === contractEndDate && contractEndDate < lastEntitlementDay),
    adjustedStartByBirth: Boolean(theoreticalStart && birthDate && theoreticalStart < birthDate),
    adjustedStartByContract: Boolean(theoreticalStart && contractStartDate && theoreticalStart < contractStartDate),
    noAvailabilityReason,
    totalEligibleWorkdays: allEligibleDays.length,
    consumedEligibleWorkdays: consumedEligibleDays.length,
    totalHours,
    consumedHours,
    remainingHours,
    eqDays,
    wholeDays,
    remainderHours,
    consumedEqDays
  };
}

function computeSms28Engine() {
  const theoreticalTotalDays = 28 * Math.max(1, Number(state.form.multipleChildren) || 1);
  const start = state.form.lactationStartDate;
  const asOf = state.form.asOfDate || todayISO;
  const contractEndDate = state.form.contractEndDate || '';
  const lastByAge = state.form.birthDate ? toISO(addDays(toDate(addMonthsISO(state.form.birthDate, 12)), -1)) : '';

  if (!start) {
    return {
      startUsed: false,
      totalDays: theoreticalTotalDays,
      consumedNaturalDays: 0,
      remainingNaturalDays: theoreticalTotalDays,
      projectedEnd: '',
      limitedByContract: false
    };
  }

  const theoreticalEnd = toISO(addDays(toDate(start), theoreticalTotalDays - 1));
  const projectedEnd = minDateIso(theoreticalEnd, contractEndDate || theoreticalEnd, lastByAge || theoreticalEnd);
  const limitedByContract = Boolean(contractEndDate && projectedEnd === contractEndDate && contractEndDate < theoreticalEnd);
  const totalDays = projectedEnd && projectedEnd >= start ? Math.min(theoreticalTotalDays, diffDaysInclusive(start, projectedEnd)) : 0;
  const effectiveAsOf = projectedEnd ? minDateIso(asOf, projectedEnd) : '';
  const consumedNaturalDays = effectiveAsOf && effectiveAsOf >= start ? Math.min(totalDays, diffDaysInclusive(start, effectiveAsOf)) : 0;

  return {
    startUsed: true,
    totalDays,
    consumedNaturalDays,
    remainingNaturalDays: Math.max(0, totalDays - consumedNaturalDays),
    projectedEnd,
    limitedByContract
  };
}

async function handleOcrFile(file) {
  state.ocr.processing = true;
  setOcrStatus('Procesando imagen y reconstruyendo filas…', 'info');
  state.ocr.previewUrl = URL.createObjectURL(file);
  renderOcr();

  try {
    const processedBlob = await preprocessImage(file);
    const worker = await Tesseract.createWorker('spa+eng');
    const candidates = [];
    for (const source of [file, processedBlob].filter(Boolean)) {
      const ret = await worker.recognize(source);
      const text = ret?.data?.text || '';
      const confidence = Number(ret?.data?.confidence || 0);
      const parsed = parseMovementRecordsFromText(text, state.form.asOfDate || todayISO);
      const score = parsed.records.length * 25 + confidence;
      candidates.push({ parsed, score });
    }
    await worker.terminate();

    const best = candidates.sort((a, b) => b.score - a.score)[0];
    state.ocr.rawText = best?.parsed?.normalizedText || '';
    state.ocr.records = best?.parsed?.records || [];
    state.ocr.allDates = best?.parsed?.allDates || [];

    if (state.ocr.records.length) {
      setOcrStatus(`OCR completado. ${state.ocr.records.length} movimientos detectados.`, 'success');
    } else {
      setOcrStatus('No se han podido reconstruir filas válidas. Revisa la captura o corrige manualmente el texto.', 'error');
    }
  } catch (error) {
    console.error(error);
    setOcrStatus('No se ha podido procesar la imagen en este navegador.', 'error');
  }

  state.ocr.processing = false;
  renderOcr();
}

function renderOcr() {
  el.ocrStatus.className = `status ${state.ocr.statusType}`;
  el.ocrStatus.textContent = state.ocr.status;
  el.ocrPreviewWrap.classList.toggle('hidden', !state.ocr.previewUrl);
  if (state.ocr.previewUrl) el.ocrPreview.src = state.ocr.previewUrl;
  el.ocrRawText.value = state.ocr.rawText || '';
  el.ocrDates.innerHTML = state.ocr.allDates.map(date => badgeHtml(formatDate(date), 'blue')).join('') || '<span class="hint">Sin fechas detectadas todavía.</span>';

  const summary = getOcrSummary();
  el.ocrSummaryStats.innerHTML = state.ocr.records.length ? [
    statHtml('Movimientos', `${summary.totalRows}`, 'Filas detectadas'),
    statHtml('Días naturales', `${formatNumber(summary.totalNaturalDays)}`, 'Suma total'),
    statHtml('Días laborables', `${formatNumber(summary.totalWorkdays)}`, 'Según calendario'),
    statHtml('Horas', `${formatNumber(summary.totalHours)} h`, 'Equivalencia por jornada')
  ].join('') : '';

  if (!state.ocr.records.length) {
    el.ocrTableWrap.className = 'table-wrap empty-state';
    el.ocrTableWrap.textContent = 'Cuando el OCR detecte movimientos, aparecerán aquí agrupados por filas.';
    el.applyOcrBtn.disabled = true;
    return;
  }

  el.applyOcrBtn.disabled = false;
  el.ocrTableWrap.className = 'table-wrap';
  el.ocrTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Concepto</th>
          <th>Inicio</th>
          <th>Fin</th>
          <th>Días</th>
          <th>Laborables</th>
          <th>Horas</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${summary.rows.map(row => `
          <tr data-id="${escapeAttr(row.id)}">
            <td>
              <input data-field="concept" type="text" value="${escapeAttr(row.concept)}" />
              <div class="badges" style="margin-top:8px;">
                ${row.discountable ? badgeHtml('Descontable', 'amber') : badgeHtml('Informativo')}
                ${row.endImputed ? badgeHtml('Fin por fecha consulta', 'blue') : badgeHtml('Rango cerrado', 'green')}
              </div>
            </td>
            <td><input data-field="start" type="date" value="${escapeAttr(row.start)}" /></td>
            <td><input data-field="end" type="date" value="${escapeAttr(row.end || '')}" /></td>
            <td>${formatNumber(row.naturalDays)}</td>
            <td>${formatNumber(row.workdays)}</td>
            <td>${formatNumber(row.hours)} h</td>
            <td>${row.endImputed ? 'Abierto' : 'Cerrado'}</td>
            <td><button class="icon-btn" data-action="delete">🗑</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  el.ocrTableWrap.querySelectorAll('tr[data-id]').forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', () => updateOcrRecord(id, input.dataset.field, input.value));
    });
    tr.querySelector('[data-action="delete"]').addEventListener('click', () => {
      state.ocr.records = state.ocr.records.filter(r => r.id !== id);
      renderOcr();
    });
  });
}

function getOcrSummary() {
  const rows = state.ocr.records.map(record => {
    const effectiveEnd = record.end || state.form.asOfDate || todayISO;
    const naturalDays = record.start ? diffDaysInclusive(record.start, effectiveEnd) : 0;
    const workdays = record.start ? countWorkdaysInRange(record.start, effectiveEnd, state.form.workdays) : 0;
    const hours = round2(workdays * Number(state.form.dailyHours || 0));
    const meta = canonicalizeConcept(record.concept);
    return {
      ...record,
      ...meta,
      effectiveEnd,
      endImputed: !record.end,
      naturalDays,
      workdays,
      hours
    };
  });

  return {
    rows,
    totalRows: rows.length,
    totalNaturalDays: rows.reduce((acc, row) => acc + row.naturalDays, 0),
    totalWorkdays: rows.reduce((acc, row) => acc + row.workdays, 0),
    totalHours: round2(rows.reduce((acc, row) => acc + row.hours, 0))
  };
}

function updateOcrRecord(id, field, value) {
  state.ocr.records = state.ocr.records.map(record => record.id === id ? { ...record, [field]: value } : record);
  renderOcr();
}

function applyOcrToForm() {
  const records = getOcrSummary().rows;
  const birthRecord = chooseBestMovementRecord(records, 'PERMISO_NACIMIENTO');
  const incorporationRecord = chooseBestMovementRecord(records, 'INCORPORACION_ESTATUTARIO');
  const discountableRanges = records.filter(r => r.discountable && r.start).map(r => ({
    start: r.start,
    end: r.end || r.effectiveEnd,
    reason: r.label
  }));

  if (birthRecord) {
    state.form.caseType = 'nacimiento';
    state.form.birthDate = birthRecord.start;
    el.caseType.value = state.form.caseType;
    el.birthDate.value = state.form.birthDate;

    state.form.leaveEndDate = birthRecord.end || '';
    el.leaveEndDate.value = state.form.leaveEndDate;
  }

  if (incorporationRecord?.start) {
    state.form.contractStartDate = incorporationRecord.start;
    el.contractStartDate.value = state.form.contractStartDate;

    state.form.contractEndDate = incorporationRecord.end || '';
    el.contractEndDate.value = state.form.contractEndDate;
  }

  if (birthRecord?.end) {
    state.form.lactationStartDate = toISO(addDays(toDate(birthRecord.end), 1));
    el.lactationStartDate.value = state.form.lactationStartDate;
  }

  state.excludedRanges = [...state.excludedRanges, ...discountableRanges];
  const ocrLines = records.map(r => `${r.label}: ${formatDate(r.start)} - ${formatDate(r.end || r.effectiveEnd)}`).join('\n');
  state.form.notes = [state.form.notes, 'OCR aplicado y validado en tabla de comprobación.', ocrLines].filter(Boolean).join('\n\n');
  el.notes.value = state.form.notes;

  renderExcludedRanges();
  renderCalculations();

  document.querySelector('[data-tab="calculator"]').click();
}

function setOcrStatus(text, type) {
  state.ocr.status = text;
  state.ocr.statusType = type;
}

function parseMovementRecordsFromText(text, consultationDate) {
  const normalized = normalizeOCRText(text);
  const lines = normalized.split(/\n+/).map(l => l.trim()).filter(Boolean).filter(line => !isHeaderLine(line));
  const records = [];
  let conceptBuffer = [];
  let pendingStart = '';

  for (const line of lines) {
    const dates = extractDates(line);
    const conceptInLine = stripDatesFromLine(line);

    if (!dates.length) {
      if (looksLikeConcept(line)) conceptBuffer.push(conceptInLine);
      continue;
    }

    if (looksLikeConcept(conceptInLine)) conceptBuffer.push(conceptInLine);
    const conceptText = conceptBuffer.join(' ').trim() || conceptInLine || 'OTRO';

    if (dates.length >= 2) {
      records.push(buildMovementRecord(conceptText, dates[0], dates[1], consultationDate));
      conceptBuffer = [];
      pendingStart = '';
      continue;
    }

    if (!pendingStart) {
      pendingStart = dates[0];
      continue;
    }

    records.push(buildMovementRecord(conceptText, pendingStart, dates[0], consultationDate));
    conceptBuffer = [];
    pendingStart = '';
  }

  if (pendingStart || conceptBuffer.length) {
    const conceptText = conceptBuffer.join(' ').trim() || 'OTRO';
    if (pendingStart) records.push(buildMovementRecord(conceptText, pendingStart, '', consultationDate));
  }

  const unique = [];
  const seen = new Set();
  records.forEach(r => {
    const key = `${r.concept}|${r.start}|${r.end || consultationDate}`;
    if (r.start && !seen.has(key)) {
      unique.push(r);
      seen.add(key);
    }
  });

  return {
    records: unique.sort((a, b) => (a.start > b.start ? 1 : -1)),
    allDates: [...new Set(extractDates(normalized))],
    normalizedText: normalized
  };
}

function buildMovementRecord(conceptText, start, end, consultationDate) {
  const meta = canonicalizeConcept(conceptText);
  return {
    id: `${meta.key}-${start}-${end || consultationDate}-${Math.random().toString(36).slice(2, 7)}`,
    concept: meta.label,
    conceptKey: meta.key,
    rawConcept: conceptText || '',
    start: start || '',
    end: end || '',
    effectiveEnd: end || consultationDate,
    endImputed: !end
  };
}

function movementMatches(record, movementKey) {
  const definition = MOVEMENT_DEFINITION_MAP[movementKey];
  if (!record || !definition) return false;
  const pool = [record.concept, record.rawConcept].filter(Boolean).join(' ');
  return record.conceptKey === movementKey || definition.regex.test(normalizeOCRText(pool));
}

function chooseBestMovementRecord(records, movementKey) {
  const candidates = (records || []).filter(record => movementMatches(record, movementKey) && record.start);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const scoreA = (a.end ? 1000 : 0) + diffDaysInclusive(a.start, a.end || a.effectiveEnd || a.start);
    const scoreB = (b.end ? 1000 : 0) + diffDaysInclusive(b.start, b.end || b.effectiveEnd || b.start);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.start.localeCompare(b.start);
  })[0];
}

function canonicalizeConcept(rawConcept) {
  const clean = normalizeOCRText(rawConcept).trim();
  const found = MOVEMENT_DEFINITIONS.find(item => item.regex.test(clean));
  if (found) return found;
  return { key: 'OTRO', label: clean || 'OTRO', discountable: false };
}

function extractDates(text) {
  const results = [];
  for (const match of normalizeOCRText(text).matchAll(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g)) {
    const d = Number(match[1]);
    const m = Number(match[2]);
    const y = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    const iso = toISO(new Date(y, m - 1, d, 12, 0, 0, 0));
    if (iso) results.push(iso);
  }
  return results;
}

function normalizeOCRText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|¦]/g, ' ')
    .replace(/[“”‘’]/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\b1NCORPORACION\b/g, 'INCORPORACION')
    .replace(/\b1NTERINO\b/g, 'INTERINO')
    .replace(/\bNAC1MIENTO\b/g, 'NACIMIENTO')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .toUpperCase();
}

function stripDatesFromLine(line) {
  return normalizeOCRText(line)
    .replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g, ' ')
    .replace(/[;:,_-]+/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

function isHeaderLine(line) {
  return OCR_HEADER_PATTERNS.some(pattern => pattern.test(normalizeOCRText(line).trim()));
}

function looksLikeConcept(text) {
  const clean = stripDatesFromLine(text);
  return /[A-Z]/.test(clean) && clean.length >= 5 && !isHeaderLine(clean);
}

async function preprocessImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    const img = new Image();
    reader.onload = () => { img.src = String(reader.result || ''); };
    reader.onerror = () => resolve(null);
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const value = avg > 185 ? 255 : 0;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    };
    img.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function countWorkdaysInRange(startIso, endIso, workdays) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end || end < start) return 0;
  const cursor = new Date(start);
  let total = 0;
  while (cursor <= end) {
    if (workdays.includes(cursor.getDay())) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function parseExcludedDates(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
}

function isExcludedByRanges(iso, ranges) {
  return ranges.some(r => r.start && r.end && iso >= r.start && iso <= r.end);
}

function eachDay(startIso, endIsoExclusive) {
  const start = toDate(startIso);
  const end = toDate(endIsoExclusive);
  if (!start || !end) return [];
  const out = [];
  const cursor = new Date(start);
  while (cursor < end) {
    out.push(toISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function toDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonthsISO(iso, months) {
  const date = toDate(iso);
  if (!date) return '';
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return toISO(copy);
}

function minDateIso(...values) {
  const valid = values.filter(Boolean).map(toDate).filter(Boolean);
  if (!valid.length) return '';
  return toISO(new Date(Math.min(...valid.map(v => v.getTime()))));
}

function maxDateIso(...values) {
  const valid = values.filter(Boolean).map(toDate).filter(Boolean);
  if (!valid.length) return '';
  return toISO(new Date(Math.max(...valid.map(v => v.getTime()))));
}

function diffDaysInclusive(startIso, endIso) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function formatDate(iso) {
  const date = toDate(iso);
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
}

function labelizeCase(value) {
  return ({ nacimiento: 'Nacimiento', adopcion: 'Adopción', guarda: 'Guarda con fines de adopción', acogimiento: 'Acogimiento' })[value] || value;
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function badgeHtml(text, tone = '') {
  return `<span class="badge ${tone ? `badge-${tone}` : ''}">${escapeHtml(text)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
