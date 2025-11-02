import {
  parseExpression,
  nodeToString,
  dependsOn,
  flattenProduct,
  flattenSum,
  makeDiv,
  makeMul,
  makeAdd,
  makeSub,
  makeNeg,
  createNumber,
  createVariable,
  createFunction,
  simplifyNode,
  evaluateNode,
  cloneNode,
  isVariableNode
} from './parser.js';
import { integrate } from './integrator.js';

export function processEquation(rawInput) {
  try {
    const parsed = parseDifferentialEquation(rawInput);
    const classification = classifyEquation(parsed.rhs);
    if (classification.type === 'direct') {
      return buildDirectSolution(parsed, classification);
    }
    if (classification.type === 'separable') {
      return buildSeparableSolution(parsed, classification);
    }
    if (classification.type === 'linear') {
      return buildLinearSolution(parsed, classification);
    }
    return {
      status: 'unsupported',
      message: 'در حال حاضر این معادله پشتیبانی نمی‌شود. سعی کن فرم را ساده‌تر وارد کنی یا فقط معادلات جداشدنی و خطی مرتبه اول را امتحان کن.'
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message || 'خطای ناشناخته هنگام پردازش معادله رخ داده است.'
    };
  }
}

export function createDerivativeEvaluator(rhsNode) {
  return (x, y) => {
    try {
      const value = evaluateNode(rhsNode, { x, y });
      if (!Number.isFinite(value)) {
        return NaN;
      }
      return value;
    } catch (error) {
      return NaN;
    }
  };
}

function parseDifferentialEquation(rawInput) {
  const cleaned = rawInput.replace(/\s+/g, ' ').replace(/،/g, ',').trim();
  if (!cleaned.includes('=')) {
    throw new Error('معادله باید شامل علامت = باشد.');
  }
  const [lhsRaw, rhsRaw] = cleaned.split('=').map((part) => part.trim());
  const lhsNormalized = lhsRaw.replace(/\s+/g, '').toLowerCase();
  if (lhsNormalized !== 'dy/dx') {
    throw new Error('سمت چپ معادله باید به صورت dy/dx باشد.');
  }
  const rhsAst = parseExpression(rhsRaw);
  return {
    rhs: rhsAst,
    normalizedEquation: `dy/dx = ${nodeToString(rhsAst)}`
  };
}

function classifyEquation(rhs) {
  if (!dependsOn(rhs, 'y')) {
    return { type: 'direct', rhs };
  }
  const separable = detectSeparable(rhs);
  if (separable) {
    return { type: 'separable', rhs, ...separable };
  }
  const linear = detectLinear(rhs);
  if (linear) {
    return { type: 'linear', rhs, ...linear };
  }
  return { type: 'unsupported', rhs };
}

function buildDirectSolution(parsed, classification) {
  const integral = integrate(classification.rhs, 'x');
  if (!integral) {
    throw new Error('انتگرال سمت راست به سادگی قابل محاسبه نیست.');
  }
  const rhsText = nodeToString(classification.rhs);
  const integralText = nodeToString(integral);
  const steps = [
    {
      title: 'گام ۱: تشخیص ساختار',
      description: 'سمت راست معادله فقط تابعی از x است، پس می‌توانیم با انتگرال‌گیری مستقیم طرفین معادله را حل کنیم.'
    },
    {
      title: 'گام ۲: انتگرال‌گیری طرفین',
      description: 'انتگرال طرف چپ برابر y و انتگرال طرف راست برابر انتگرال تابع x است.',
      equationLine: `∫ dy = ∫ (${rhsText}) dx`
    },
    {
      title: 'گام ۳: به دست آوردن پاسخ نهایی',
      description: 'با انجام انتگرال‌گیری، جواب کلی معادله به دست می‌آید.',
      equationLine: `y(x) = ${integralText} + C`
    }
  ];
  return {
    status: 'ok',
    classification: 'direct',
    normalizedEquation: parsed.normalizedEquation,
    hint: 'این معادله فقط به x وابسته است، پس با یک انتگرال‌گیری ساده حل می‌شود.',
    steps,
    finalSolution: `y(x) = ${integralText} + C`,
    rhsNode: classification.rhs
  };
}

function buildSeparableSolution(parsed, classification) {
  const { xPart, yPart } = classification;
  const xText = nodeToString(xPart);
  const yText = nodeToString(yPart);
  const leftIntegrand = simplifyNode(makeDiv(createNumber(1), yPart));
  const rightIntegrand = simplifyNode(xPart);
  const leftIntegral = integrate(leftIntegrand, 'y');
  const rightIntegral = integrate(rightIntegrand, 'x');
  if (!leftIntegral || !rightIntegral) {
    throw new Error('انتگرال‌های لازم برای حل جداشدنی در دسترس نبودند.');
  }
  const leftText = nodeToString(leftIntegral);
  const rightText = nodeToString(rightIntegral);
  const implicitSolution = `${leftText} = ${rightText} + C`;
  const explicit = deriveExplicitFromSeparable(leftIntegral, rightIntegral);
  const steps = [
    {
      title: 'گام ۱: تشخیص معادله جداشدنی',
      description: 'معادله را به صورت حاصل‌ضرب تابعی از x و تابعی از y نوشتیم، پس جداشدنی است.'
    },
    {
      title: 'گام ۲: جدا کردن متغیرها',
      description: 'طرفین معادله را تقسیم می‌کنیم تا هر سمت فقط شامل یک متغیر باشد.',
      equationLine: `1/(${yText}) dy = (${xText}) dx`
    },
    {
      title: 'گام ۳: انتگرال‌گیری طرفین',
      description: 'روی هر دو سمت انتگرال می‌گیریم تا به رابطه بین x و y برسیم.',
      equationLine: `∫ 1/(${yText}) dy = ∫ (${xText}) dx`
    },
    {
      title: 'گام ۴: پاسخ کلی',
      description: 'نتیجه نهایی را می‌توان به صورت ضمنی نوشت و در صورت امکان به فرم صریح ساده کرد.',
      equationLine: implicitSolution
    }
  ];
  if (explicit) {
    steps.push({
      title: 'گام ۵: بیان پاسخ صریح',
      description: 'با ساده‌سازی عبارت لگاریتمی، پاسخ را به فرم صریح نوشتیم.',
      equationLine: explicit
    });
  }
  return {
    status: 'ok',
    classification: 'separable',
    normalizedEquation: parsed.normalizedEquation,
    hint: 'این معادله جداشدنی است. سعی کن yها را به یک سمت و xها را به سمت دیگر ببری.',
    steps,
    finalSolution: explicit || implicitSolution,
    rhsNode: classification.rhs
  };
}

function buildLinearSolution(parsed, classification) {
  const { aNode, bNode, rhs } = classification;
  const P = simplifyNode(makeNeg(aNode));
  const Q = simplifyNode(bNode);
  const pText = nodeToString(P);
  const qText = nodeToString(Q);
  const integralP = integrate(P, 'x');
  if (!integralP) {
    throw new Error('انتگرال P(x) به سادگی محاسبه نشد.');
  }
  const muNode = simplifyNode(createFunction('exp', cloneNode(integralP)));
  const muText = nodeToString(muNode);
  const integralPText = nodeToString(integralP);
  const muQNode = simplifyNode(makeMul(muNode, Q));
  const integralMuQ = integrate(muQNode, 'x');
  const muQText = nodeToString(muQNode);
  let finalExpression;
  let integratedMuQText = null;
  if (integralMuQ) {
    integratedMuQText = nodeToString(integralMuQ);
    finalExpression = `y(x) = (${integratedMuQText} + C) / ${muText}`;
  } else {
    finalExpression = `y(x) = (1/${muText}) * (∫ (${muQText}) dx + C)`;
  }
  const steps = [
    {
      title: 'گام ۱: تشخیص معادله خطی مرتبه اول',
      description: 'معادله را به فرم dy/dx + P(x) y = Q(x) بازنویسی می‌کنیم.'
    },
    {
      title: 'گام ۲: تعیین P(x) و Q(x)',
      description: 'ضریب y را با علامت منفی به عنوان P(x) و بقیه عبارت را به عنوان Q(x) در نظر می‌گیریم.',
      equationLine: `P(x) = ${pText}   ،   Q(x) = ${qText}`
    },
    {
      title: 'گام ۳: محاسبه عامل انتگرال‌ساز',
      description: 'عامل انتگرال‌ساز از رابطه μ(x) = exp(∫ P(x) dx) به دست می‌آید.',
      equationLine: `μ(x) = exp(${integralPText}) = ${muText}`
    },
    {
      title: 'گام ۴: ضرب طرفین در μ(x)',
      description: 'با ضرب کل معادله در μ(x)، سمت چپ به مشتق μ(x)·y تبدیل می‌شود.',
      equationLine: `d/dx [μ(x) · y] = μ(x) · Q(x) = ${muQText}`
    },
    {
      title: 'گام ۵: انتگرال‌گیری نهایی',
      description: 'از دو طرف نسبت به x انتگرال می‌گیریم تا عبارت μ(x)·y را به دست آوریم.',
      equationLine: `μ(x) · y = ∫ (${muQText}) dx + C`
    }
  ];
  if (integratedMuQText) {
    steps.push({
      title: 'گام ۶: جواب نهایی',
      description: 'با تقسیم بر μ(x)، پاسخ نهایی به دست می‌آید.',
      equationLine: finalExpression
    });
  } else {
    steps.push({
      title: 'گام ۶: فرم کلی پاسخ',
      description: 'اگر انتگرال سمت راست ساده نباشد، پاسخ را به صورت عمومی نگه می‌داریم.',
      equationLine: finalExpression
    });
  }
  return {
    status: 'ok',
    classification: 'linear',
    normalizedEquation: parsed.normalizedEquation,
    hint: 'این معادله خطی مرتبه اول است. با محاسبه عامل انتگرال‌ساز و ضرب در آن می‌توانی حلش کنی.',
    steps,
    finalSolution: finalExpression,
    rhsNode: rhs
  };
}

function detectSeparable(rhs) {
  const factors = flattenProduct(rhs);
  const xNum = [];
  const xDen = [];
  const yNum = [];
  const yDen = [];
  const cNum = [];
  const cDen = [];
  for (const factor of factors) {
    const node = factor.node;
    const inDenominator = factor.denominator;
    const hasX = dependsOn(node, 'x');
    const hasY = dependsOn(node, 'y');
    if (hasX && hasY) {
      return null;
    }
    if (hasY) {
      if (inDenominator) {
        yDen.push(node);
      } else {
        yNum.push(node);
      }
    } else if (hasX) {
      if (inDenominator) {
        xDen.push(node);
      } else {
        xNum.push(node);
      }
    } else {
      if (inDenominator) {
        cDen.push(node);
      } else {
        cNum.push(node);
      }
    }
  }
  if (yNum.length === 0 && yDen.length === 0) {
    return null;
  }
  const xPart = buildProduct([...xNum, ...cNum], [...xDen, ...cDen]);
  const yPart = buildProduct(yNum, yDen);
  if (!dependsOn(yPart, 'y')) {
    return null;
  }
  return { xPart, yPart };
}

function detectLinear(rhs) {
  const terms = flattenSum(rhs);
  const coefficientTerms = [];
  const freeTerms = [];
  for (const term of terms) {
    if (dependsOn(term, 'y')) {
      const coeff = extractLinearCoefficient(term);
      if (!coeff) {
        return null;
      }
      coefficientTerms.push(coeff);
    } else {
      freeTerms.push(term);
    }
  }
  if (!coefficientTerms.length) {
    return null;
  }
  const aNode = simplifyNode(sumNodes(coefficientTerms));
  const bNode = simplifyNode(sumNodes(freeTerms));
  if (dependsOn(aNode, 'y') || dependsOn(bNode, 'y')) {
    return null;
  }
  return { aNode, bNode };
}

function extractLinearCoefficient(term) {
  const factors = flattenProduct(term);
  const numerator = [];
  const denominator = [];
  let yCount = 0;
  for (const item of factors) {
    const node = item.node;
    if (item.denominator) {
      if (dependsOn(node, 'y')) {
        return null;
      }
      denominator.push(node);
      continue;
    }
    if (isVariableNode(node, 'y')) {
      yCount += 1;
      continue;
    }
    if (node.type === 'binary' && node.op === '^' && isVariableNode(node.left, 'y') && node.right.type === 'number') {
      if (Math.abs(node.right.value - 1) < 1e-9) {
        yCount += 1;
        continue;
      }
      return null;
    }
    if (dependsOn(node, 'y')) {
      return null;
    }
    numerator.push(node);
  }
  if (yCount !== 1) {
    return null;
  }
  return buildProduct(numerator, denominator);
}

function buildProduct(numeratorNodes, denominatorNodes) {
  let result = productOf(numeratorNodes);
  for (const den of denominatorNodes) {
    result = makeDiv(result, den);
  }
  return simplifyNode(result);
}

function productOf(nodes) {
  if (!nodes.length) {
    return createNumber(1);
  }
  return nodes.reduce((acc, node) => (acc ? makeMul(acc, node) : node), null);
}

function sumNodes(nodes) {
  if (!nodes.length) {
    return createNumber(0);
  }
  return nodes.reduce((acc, node) => (acc ? makeAdd(acc, node) : node), null);
}

function deriveExplicitFromSeparable(leftIntegral, rightIntegral) {
  if (leftIntegral.type === 'function' && leftIntegral.name === 'ln') {
    const arg = leftIntegral.argument;
    if (arg.type === 'function' && arg.name === 'abs' && arg.argument && isVariableNode(arg.argument, 'y')) {
      return `y = C · exp(${nodeToString(rightIntegral)})`;
    }
  }
  return null;
}
