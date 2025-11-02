import {
  createNumber,
  createVariable,
  createFunction,
  makeAdd,
  makeSub,
  makeMul,
  makeDiv,
  makePow,
  makeNeg,
  simplifyNode,
  dependsOn,
  isConstantWithRespectTo,
  isVariableNode,
  cloneNode
} from './parser.js';

export function integrate(node, variable) {
  const result = integrateInternal(node, variable);
  if (!result) {
    return null;
  }
  return simplifyNode(result);
}

function integrateInternal(node, variable) {
  if (!dependsOn(node, variable)) {
    return makeMul(node, createVariable(variable));
  }

  if (node.type === 'number') {
    return makeMul(node, createVariable(variable));
  }

  if (node.type === 'variable') {
    if (node.name === variable) {
      return makeMul(createNumber(0.5), makePow(createVariable(variable), createNumber(2)));
    }
    return makeMul(node, createVariable(variable));
  }

  if (node.type === 'unary' && node.op === 'u-') {
    const integrated = integrateInternal(node.argument, variable);
    if (!integrated) return null;
    return makeNeg(integrated);
  }

  if (node.type === 'binary') {
    const { op, left, right } = node;
    if (op === '+') {
      const leftInt = integrateInternal(left, variable);
      const rightInt = integrateInternal(right, variable);
      if (!leftInt || !rightInt) return null;
      return makeAdd(leftInt, rightInt);
    }
    if (op === '-') {
      const leftInt = integrateInternal(left, variable);
      const rightInt = integrateInternal(right, variable);
      if (!leftInt || !rightInt) return null;
      return makeSub(leftInt, rightInt);
    }
    if (op === '*') {
      if (isConstantWithRespectTo(left, variable)) {
        const rightInt = integrateInternal(right, variable);
        if (!rightInt) return null;
        return makeMul(left, rightInt);
      }
      if (isConstantWithRespectTo(right, variable)) {
        const leftInt = integrateInternal(left, variable);
        if (!leftInt) return null;
        return makeMul(right, leftInt);
      }
      return null;
    }
    if (op === '/') {
      if (!dependsOn(right, variable) && dependsOn(left, variable)) {
        const denominator = right;
        const integral = integrateInternal(left, variable);
        if (!integral) return null;
        return makeDiv(integral, denominator);
      }
      if (!dependsOn(left, variable) && dependsOn(right, variable)) {
        const numeratorValue = extractNumericConstant(left);
        if (numeratorValue === null) return null;
        const linearInfo = matchLinear(right, variable);
        if (linearInfo && linearInfo.a !== 0) {
          const factor = numeratorValue / linearInfo.a;
          const inside = linearInfo.node;
          return makeMul(createNumber(factor), createFunction('ln', createFunction('abs', inside)));
        }
        if (isVariableNode(right, variable) && Math.abs(numeratorValue) > 0) {
          const factor = numeratorValue;
          return makeMul(createNumber(factor), createFunction('ln', createFunction('abs', createVariable(variable))));
        }
      }
      return null;
    }
    if (op === '^') {
      if (isVariableNode(left, variable) && right.type === 'number') {
        const power = right.value;
        if (Math.abs(power + 1) < 1e-9) {
          return createFunction('ln', createFunction('abs', createVariable(variable)));
        }
        const newExp = power + 1;
        const coefficient = 1 / newExp;
        return makeMul(createNumber(coefficient), makePow(createVariable(variable), createNumber(newExp)));
      }
      return null;
    }
    return null;
  }

  if (node.type === 'function') {
    const arg = node.argument;
    const linearInfo = matchLinear(arg, variable);
    switch (node.name) {
      case 'exp':
        if (linearInfo && linearInfo.a !== 0) {
          const factor = 1 / linearInfo.a;
          return makeMul(createNumber(factor), createFunction('exp', cloneNode(arg)));
        }
        break;
      case 'sin':
        if (linearInfo && linearInfo.a !== 0) {
          const factor = -1 / linearInfo.a;
          return makeMul(createNumber(factor), createFunction('cos', cloneNode(arg)));
        }
        break;
      case 'cos':
        if (linearInfo && linearInfo.a !== 0) {
          const factor = 1 / linearInfo.a;
          return makeMul(createNumber(factor), createFunction('sin', cloneNode(arg)));
        }
        break;
      case 'tan':
        if (linearInfo && linearInfo.a !== 0) {
          const factor = -1 / linearInfo.a;
          return makeMul(createNumber(factor), createFunction('ln', createFunction('abs', createFunction('cos', cloneNode(arg)))));
        }
        break;
      case 'ln':
      case 'log':
        if (matchLinear(arg, variable) && !dependsOn(arg, variable)) {
          return makeMul(node, createVariable(variable));
        }
        break;
      default:
        break;
    }
  }
  return null;
}

function extractNumericConstant(node) {
  if (!dependsOn(node, 'x') && !dependsOn(node, 'y')) {
    if (node.type === 'number') return node.value;
  }
  return null;
}

function matchLinear(node, variable) {
  const result = matchLinearRecursive(node, variable);
  if (!result) return null;
  if (Math.abs(result.a) < 1e-9) {
    return { a: 0, b: result.b, node: simplifyNode(result.b) };
  }
  const linearNode = simplifyNode(makeAdd(makeMul(createNumber(result.a), createVariable(variable)), result.b));
  return { a: result.a, b: result.b, node: linearNode };
}

function matchLinearRecursive(node, variable) {
  if (!dependsOn(node, variable)) {
    return { a: 0, b: node };
  }
  if (isVariableNode(node, variable)) {
    return { a: 1, b: createNumber(0) };
  }
  if (node.type === 'unary' && node.op === 'u-') {
    const inner = matchLinearRecursive(node.argument, variable);
    if (!inner) return null;
    return { a: -inner.a, b: makeNeg(inner.b) };
  }
  if (node.type === 'binary') {
    const { op, left, right } = node;
    if (op === '+') {
      const leftLinear = matchLinearRecursive(left, variable);
      const rightLinear = matchLinearRecursive(right, variable);
      if (!leftLinear || !rightLinear) return null;
      return {
        a: leftLinear.a + rightLinear.a,
        b: makeAdd(leftLinear.b, rightLinear.b)
      };
    }
    if (op === '-') {
      const leftLinear = matchLinearRecursive(left, variable);
      const rightLinear = matchLinearRecursive(right, variable);
      if (!leftLinear || !rightLinear) return null;
      return {
        a: leftLinear.a - rightLinear.a,
        b: makeSub(leftLinear.b, rightLinear.b)
      };
    }
    if (op === '*') {
      if (isConstantWithRespectTo(left, variable)) {
        const leftConst = extractNumericConstant(left);
        if (leftConst === null) return null;
        const rightLinear = matchLinearRecursive(right, variable);
        if (!rightLinear) return null;
        return {
          a: rightLinear.a * leftConst,
          b: makeMul(createNumber(leftConst), rightLinear.b)
        };
      }
      if (isConstantWithRespectTo(right, variable)) {
        const rightConst = extractNumericConstant(right);
        if (rightConst === null) return null;
        const leftLinear = matchLinearRecursive(left, variable);
        if (!leftLinear) return null;
        return {
          a: leftLinear.a * rightConst,
          b: makeMul(createNumber(rightConst), leftLinear.b)
        };
      }
      return null;
    }
    if (op === '/') {
      if (isConstantWithRespectTo(right, variable)) {
        const constValue = extractNumericConstant(right);
        if (constValue === null || Math.abs(constValue) < 1e-9) return null;
        const leftLinear = matchLinearRecursive(left, variable);
        if (!leftLinear) return null;
        return {
          a: leftLinear.a / constValue,
          b: makeDiv(leftLinear.b, createNumber(constValue))
        };
      }
      return null;
    }
  }
  return null;
}

// no-op placeholders removed
