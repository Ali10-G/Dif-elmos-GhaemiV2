import { setupVirtualKeyboard } from './keyboard.js';
import { processEquation, createDerivativeEvaluator } from './solver.js';
import { renderSolutionChart, clearChart } from './chart.js';
import { initThemeToggle } from './theme.js';

const equationInput = document.getElementById('equationInput');
const initialXInput = document.getElementById('initialX');
const initialYInput = document.getElementById('initialY');
const hintButton = document.getElementById('hintButton');
const stepButton = document.getElementById('stepButton');
const fullButton = document.getElementById('fullButton');
const resetButton = document.getElementById('resetButton');
const hintOutput = document.getElementById('hintOutput');
const stepOutput = document.getElementById('stepOutput');
const statusMessage = document.getElementById('statusMessage');
const keyboardContainer = document.getElementById('keyboard');
const chartCanvas = document.getElementById('solutionChart');
const chartNotice = document.getElementById('chartNotice');
const themeToggle = document.getElementById('themeToggle');

initThemeToggle(themeToggle);
setupVirtualKeyboard(keyboardContainer, equationInput);

let lastEquation = '';
let currentResult = null;
let revealedSteps = 0;
let hintShown = false;

const classificationMap = {
  direct: 'انتگرال مستقیم',
  separable: 'جداشدنی',
  linear: 'خطی مرتبه اول'
};

equationInput.addEventListener('input', () => {
  markDirty();
});

initialXInput.addEventListener('input', () => {
  updateChartIfReady(false);
});

initialYInput.addEventListener('input', () => {
  updateChartIfReady(false);
});

hintButton.addEventListener('click', () => {
  if (!ensureResult()) return;
  if (!currentResult || currentResult.status !== 'ok') return;
  hintOutput.textContent = currentResult.hint;
  hintOutput.classList.remove('hidden');
  hintShown = true;
});

stepButton.addEventListener('click', () => {
  if (!ensureResult()) return;
  if (!currentResult || currentResult.status !== 'ok') return;
  showNextStep();
});

fullButton.addEventListener('click', () => {
  if (!ensureResult()) return;
  if (!currentResult || currentResult.status !== 'ok') return;
  stepOutput.innerHTML = '';
  currentResult.steps.forEach((step) => {
    stepOutput.appendChild(renderStep(step));
  });
  revealedSteps = currentResult.steps.length;
  stepButton.disabled = true;
  updateChartIfReady(true);
});

resetButton.addEventListener('click', () => {
  equationInput.value = '';
  initialXInput.value = '';
  initialYInput.value = '';
  markDirty();
});

function ensureResult() {
  const equation = equationInput.value.trim();
  if (!equation) {
    statusMessage.textContent = 'لطفاً ابتدا معادله دیفرانسیل را وارد کن.';
    return false;
  }
  if (equation !== lastEquation || !currentResult) {
    const result = processEquation(equation);
    currentResult = result;
    lastEquation = equation;
    revealedSteps = 0;
    hintShown = false;
    hintOutput.classList.add('hidden');
    hintOutput.textContent = '';
    stepOutput.innerHTML = '';
    stepButton.disabled = false;
    clearChart(chartCanvas);
    chartNotice.textContent = '';
    if (result.status === 'ok') {
      const label = classificationMap[result.classification] || 'نامشخص';
      statusMessage.textContent = `معادله تشخیص داده شد: ${label}`;
    } else {
      statusMessage.textContent = result.message;
      return false;
    }
  } else if (currentResult.status !== 'ok') {
    statusMessage.textContent = currentResult.message;
    return false;
  }
  return true;
}

function showNextStep() {
  if (!currentResult || currentResult.status !== 'ok') return;
  if (revealedSteps >= currentResult.steps.length) {
    stepButton.disabled = true;
    updateChartIfReady(true);
    return;
  }
  const step = currentResult.steps[revealedSteps];
  stepOutput.appendChild(renderStep(step));
  revealedSteps += 1;
  if (revealedSteps >= currentResult.steps.length) {
    stepButton.disabled = true;
    updateChartIfReady(true);
  }
}

function renderStep(step) {
  const wrapper = document.createElement('div');
  wrapper.className = 'step-item';
  const title = document.createElement('h3');
  title.textContent = step.title;
  const description = document.createElement('p');
  description.textContent = step.description;
  wrapper.appendChild(title);
  wrapper.appendChild(description);
  if (step.equationLine) {
    const equationLine = document.createElement('div');
    equationLine.className = 'equation-line';
    equationLine.textContent = step.equationLine;
    wrapper.appendChild(equationLine);
  }
  return wrapper;
}

function markDirty() {
  currentResult = null;
  lastEquation = '';
  revealedSteps = 0;
  hintShown = false;
  hintOutput.classList.add('hidden');
  hintOutput.textContent = '';
  stepOutput.innerHTML = '';
  statusMessage.textContent = 'منتظر دریافت معادله هستم.';
  stepButton.disabled = false;
  clearChart(chartCanvas);
  chartNotice.textContent = '';
}

function parseInitialValue(input, fallback) {
  const value = parseFloat(input.value);
  if (Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function updateChartIfReady(force = false) {
  if (!currentResult || currentResult.status !== 'ok') {
    clearChart(chartCanvas);
    return;
  }
  if (!force && revealedSteps < currentResult.steps.length) {
    return;
  }
  const derivative = createDerivativeEvaluator(currentResult.rhsNode);
  const x0 = parseInitialValue(initialXInput, 0);
  const y0 = parseInitialValue(initialYInput, 1);
  const message = renderSolutionChart(chartCanvas, derivative, { x0, y0 });
  const usedDefaults = !initialXInput.value.trim() || !initialYInput.value.trim();
  if (message.success) {
    chartNotice.textContent = usedDefaults
      ? `${message.notice} (از مقادیر پیش‌فرض x₀ = 0 و y₀ = 1 استفاده شد.)`
      : message.notice;
  } else {
    chartNotice.textContent = message.notice || 'نتوانستم نمودار را رسم کنم.';
  }
}
