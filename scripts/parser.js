const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'exp', 'ln', 'log', 'sqrt', 'abs']);
const CONSTANTS = new Map([
  ['pi', Math.PI],
  ['e', Math.E]
]);

const OP_INFO = {
  '+': { precedence: 1, associativity: 'left', args: 2 },
  '-': { precedence: 1, associativity: 'left', args: 2 },
  '*': { precedence: 2, associativity: 'left', args: 2 },
  '/': { precedence: 2, associativity: 'left', args: 2 },
  '^': { precedence: 3, associativity: 'right', args: 2 },
  'u-': { precedence: 4, associativity: 'right', args: 1 }
};

const PREC_MAP = {
  number: 5,
  variable: 5,
  function: 5,
  unary: 4,
  '^': 3,
  '*': 2,
  '/': 2,
  '+': 1,
  '-': 1
};

function tokenize(input) {
  const tokens = [];
  let i = 0;
  let prevType = 'start';
  while (i < input.length) {
    const char = input[i];
    if (char === ' ' || char === '\t' || char === '\n') {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let numStr = char;
      i += 1;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i];
        i += 1;
      }
      if (numStr.split('.').length > 2) {
        throw new Error('عدد نامعتبر است.');
      }
      tokens.push({ type: 'number', value: parseFloat(numStr) });
      prevType = 'number';
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      let id = char;
      i += 1;
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        id += input[i];
        i += 1;
      }
      const lower = id.toLowerCase();
      if (CONSTANTS.has(lower)) {
        tokens.push({ type: 'number', value: CONSTANTS.get(lower) });
        prevType = 'number';
        continue;
      }
      if (FUNCTIONS.has(lower)) {
        tokens.push({ type: 'function', value: lower });
        prevType = 'function';
        continue;
      }
      if (lower === 'x' || lower === 'y') {
        tokens.push({ type: 'variable', value: lower });
        prevType = 'variable';
        continue;
      }
      throw new Error(`نماد ناشناخته: ${id}`);
    }
    if (char === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      prevType = 'comma';
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      prevType = 'lparen';
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      prevType = 'rparen';
      continue;
    }
    if (OP_INFO[char]) {
      let op = char;
      if (char === '-' && (prevType === 'start' || prevType === 'operator' || prevType === 'lparen' || prevType === 'comma')) {
        op = 'u-';
      }
      tokens.push({ type: 'operator', value: op });
      i += 1;
      prevType = 'operator';
      continue;
    }
    throw new Error(`کاراکتر نامعتبر: ${char}`);
  }
  return tokens;
}

function toRPN(tokens) {
  const output = [];
  const stack = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'number':
      case 'variable':
        output.push(token);
        break;
      case 'function':
        stack.push(token);
        break;
      case 'comma':
        while (stack.length && stack[stack.length - 1].type !== 'lparen') {
          output.push(stack.pop());
        }
        if (!stack.length) throw new Error('پرانتز جفت نشده است.');
        break;
      case 'operator': {
        const o1 = token.value;
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type === 'function') {
            output.push(stack.pop());
            continue;
          }
          if (top.type === 'operator') {
            const o2 = top.value;
            const info1 = OP_INFO[o1];
            const info2 = OP_INFO[o2];
            if ((info1.associativity === 'left' && info1.precedence <= info2.precedence) ||
                (info1.associativity === 'right' && info1.precedence < info2.precedence)) {
              output.push(stack.pop());
              continue;
            }
          }
          break;
        }
        stack.push(token);
        break;
      }
      case 'lparen':
        stack.push(token);
        break;
      case 'rparen': {
        let found = false;
        while (stack.length) {
          const top = stack.pop();
          if (top.type === 'lparen') {
            found = true;
            break;
          }
          output.push(top);
        }
        if (!found) throw new Error('پرانتز جفت نشده است.');
        if (stack.length && stack[stack.length - 1].type === 'function') {
          output.push(stack.pop());
        }
        break;
      }
      default:
        throw new Error('توکن ناشناخته در RPN');
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.type === 'lparen' || top.type === 'rparen') {
      throw new Error('پرانتز جفت نشده است.');
    }
    output.push(top);
  }
  return output;
}

function buildAST(rpn) {
  const stack = [];
  for (const token of rpn) {
    if (token.type === 'number') {
      stack.push(createNumber(token.value));
      continue;
    }
    if (token.type === 'variable') {
      stack.push(createVariable(token.value));
      continue;
    }
    if (token.type === 'operator') {
      const info = OP_INFO[token.value];
      if (info.args === 1) {
        if (stack.length < 1) throw new Error('عملگر یکتا آرگومان کافی ندارد.');
        const arg = stack.pop();
        stack.push(createUnary(token.value, arg));
      } else {
        if (stack.length < 2) throw new Error('عملگر دودویی آرگومان کافی ندارد.');
        const right = stack.pop();
        const left = stack.pop();
        stack.push(createBinary(token.value, left, right));
      }
      continue;
    }
    if (token.type === 'function') {
      if (!stack.length) throw new Error('تابع بدون آرگومان است.');
      const arg = stack.pop();
      stack.push(createFunction(token.value, arg));
      continue;
    }
    throw new Error('توکن ناشناخته در ساخت AST');
  }
  if (stack.length !== 1) throw new Error('ساختار معادله نامعتبر است.');
  return simplifyNode(stack[0]);
}

export function parseExpression(input) {
  if (!input || !input.trim()) {
    throw new Error('عبارت خالی است.');
  }
  const sanitized = input.replace(/−/g, '-');
  const tokens = tokenize(sanitized);
  const rpn = toRPN(tokens);
  return buildAST(rpn);
}

export function createNumber(value) {
  return { type: 'number', value };
}

export function createVariable(name) {
  return { type: 'variable', name };
}

function createUnary(op, argument) {
  return { type: 'unary', op, argument };
}

export function createFunction(name, argument) {
  return { type: 'function', name, argument };
}

export function createBinary(op, left, right) {
  return { type: 'binary', op, left, right };
}

export function cloneNode(node) {
  switch (node.type) {
    case 'number':
      return createNumber(node.value);
    case 'variable':
      return createVariable(node.name);
    case 'unary':
      return { type: 'unary', op: node.op, argument: cloneNode(node.argument) };
    case 'function':
      return createFunction(node.name, cloneNode(node.argument));
    case 'binary':
      return createBinary(node.op, cloneNode(node.left), cloneNode(node.right));
    default:
      throw new Error('گره ناشناخته برای کلون کردن');
  }
}

export function simplifyNode(node) {
  switch (node.type) {
    case 'number':
    case 'variable':
      return node;
    case 'unary': {
      const arg = simplifyNode(node.argument);
      if (node.op === 'u-') {
        if (arg.type === 'number') {
          return createNumber(-arg.value);
        }
        return createUnary('u-', arg);
      }
      return { type: 'unary', op: node.op, argument: arg };
    }
    case 'function':
      return createFunction(node.name, simplifyNode(node.argument));
    case 'binary': {
      const left = simplifyNode(node.left);
      const right = simplifyNode(node.right);
      if (left.type === 'number' && right.type === 'number') {
        return createNumber(evalBinary(node.op, left.value, right.value));
      }
      if (node.op === '+') {
        if (isZeroNode(left)) return right;
        if (isZeroNode(right)) return left;
      }
      if (node.op === '-') {
        if (isZeroNode(right)) return left;
      }
      if (node.op === '*') {
        if (isZeroNode(left) || isZeroNode(right)) return createNumber(0);
        if (isOneNode(left)) return right;
        if (isOneNode(right)) return left;
      }
      if (node.op === '/') {
        if (isZeroNode(left)) return createNumber(0);
        if (isOneNode(right)) return left;
      }
      if (node.op === '^') {
        if (isZeroNode(right)) return createNumber(1);
        if (isOneNode(right)) return left;
        if (left.type === 'number' && right.type === 'number') {
          return createNumber(Math.pow(left.value, right.value));
        }
      }
      return createBinary(node.op, left, right);
    }
    default:
      throw new Error('نوع گره ناشناخته در ساده‌سازی');
  }
}

function evalBinary(op, left, right) {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
    case '^':
      return Math.pow(left, right);
    default:
      throw new Error('عملگر ناشناخته در محاسبه');
  }
}

function isZeroNode(node) {
  return node.type === 'number' && Math.abs(node.value) < 1e-9;
}

function isOneNode(node) {
  return node.type === 'number' && Math.abs(node.value - 1) < 1e-9;
}

function getPrecedence(node) {
  if (node.type === 'binary') {
    return PREC_MAP[node.op] || 1;
  }
  if (node.type === 'unary') return PREC_MAP.unary;
  return PREC_MAP[node.type] || 4;
}

export function nodeToString(node, parentOp = null, position = 'middle') {
  switch (node.type) {
    case 'number':
      return formatNumber(node.value);
    case 'variable':
      return node.name;
    case 'unary': {
      const inner = nodeToString(node.argument, null, 'middle');
      if (node.op === 'u-') {
        return `-${needsParens(node.argument) ? '(' + inner + ')' : inner}`;
      }
      return `${node.op}${inner}`;
    }
    case 'function':
      return `${node.name}(${nodeToString(node.argument)})`;
    case 'binary': {
      const currentPrec = getPrecedence(node);
      const leftStr = nodeToString(node.left, node.op, 'left');
      const rightStr = nodeToString(node.right, node.op, 'right');
      const leftNeeds = shouldWrap(node.left, currentPrec, 'left', node.op);
      const rightNeeds = shouldWrap(node.right, currentPrec, 'right', node.op);
      const left = leftNeeds ? `(${leftStr})` : leftStr;
      const right = rightNeeds ? `(${rightStr})` : rightStr;
      return `${left} ${node.op} ${right}`;
    }
    default:
      throw new Error('نوع گره ناشناخته در تبدیل به متن');
  }
}

function needsParens(node) {
  return node.type === 'binary';
}

function shouldWrap(node, parentPrec, position, parentOp) {
  if (node.type !== 'binary') return false;
  const childPrec = getPrecedence(node);
  if (childPrec < parentPrec) return true;
  if (childPrec === parentPrec) {
    if (parentOp === '^') {
      return position === 'right';
    }
    if ((parentOp === '-' || parentOp === '/')) {
      return position === 'right';
    }
  }
  return false;
}

function formatNumber(value) {
  if (Number.isInteger(value)) return value.toString();
  return parseFloat(value.toFixed(6)).toString();
}

export function dependsOn(node, variable) {
  switch (node.type) {
    case 'number':
      return false;
    case 'variable':
      return node.name === variable;
    case 'unary':
      return dependsOn(node.argument, variable);
    case 'function':
      return dependsOn(node.argument, variable);
    case 'binary':
      return dependsOn(node.left, variable) || dependsOn(node.right, variable);
    default:
      return false;
  }
}

export function isConstantWithRespectTo(node, variable) {
  return !dependsOn(node, variable);
}

export function evaluateNode(node, scope = {}) {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'variable': {
      if (scope[node.name] === undefined) {
        throw new Error(`مقدار ${node.name} تعریف نشده است.`);
      }
      return scope[node.name];
    }
    case 'unary': {
      const value = evaluateNode(node.argument, scope);
      if (node.op === 'u-') return -value;
      throw new Error('عملگر یکتا پشتیبانی نمی‌شود.');
    }
    case 'function': {
      const arg = evaluateNode(node.argument, scope);
      switch (node.name) {
        case 'sin':
          return Math.sin(arg);
        case 'cos':
          return Math.cos(arg);
        case 'tan':
          return Math.tan(arg);
        case 'cot':
          return 1 / Math.tan(arg);
        case 'sec':
          return 1 / Math.cos(arg);
        case 'csc':
          return 1 / Math.sin(arg);
        case 'exp':
          return Math.exp(arg);
        case 'ln':
        case 'log':
          return Math.log(arg);
        case 'sqrt':
          return Math.sqrt(arg);
        case 'abs':
          return Math.abs(arg);
        default:
          throw new Error(`تابع ${node.name} پشتیبانی نمی‌شود.`);
      }
    }
    case 'binary': {
      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);
      switch (node.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '^':
          return Math.pow(left, right);
        default:
          throw new Error('عملگر ناشناخته در ارزیابی');
      }
    }
    default:
      throw new Error('نوع گره ناشناخته در ارزیابی');
  }
}

export function makeAdd(a, b) {
  return simplifyNode(createBinary('+', a, b));
}

export function makeSub(a, b) {
  return simplifyNode(createBinary('-', a, b));
}

export function makeMul(a, b) {
  return simplifyNode(createBinary('*', a, b));
}

export function makeDiv(a, b) {
  return simplifyNode(createBinary('/', a, b));
}

export function makePow(a, b) {
  return simplifyNode(createBinary('^', a, b));
}

export function makeNeg(a) {
  return simplifyNode(createUnary('u-', a));
}

export function flattenProduct(node) {
  const result = [];
  function helper(current, denominator = false) {
    if (current.type === 'binary' && current.op === '*') {
      helper(current.left, denominator);
      helper(current.right, denominator);
      return;
    }
    if (current.type === 'binary' && current.op === '/') {
      helper(current.left, denominator);
      helper(current.right, !denominator);
      return;
    }
    result.push({ node: current, denominator });
  }
  helper(node, false);
  return result;
}

export function flattenSum(node) {
  const result = [];
  function helper(current, sign = 1) {
    if (current.type === 'binary' && current.op === '+') {
      helper(current.left, sign);
      helper(current.right, sign);
      return;
    }
    if (current.type === 'binary' && current.op === '-') {
      helper(current.left, sign);
      helper(current.right, -sign);
      return;
    }
    if (sign === -1) {
      result.push(makeMul(createNumber(-1), current));
    } else {
      result.push(current);
    }
  }
  helper(node, 1);
  return result;
}

export function approxEquals(a, b, tolerance = 1e-6) {
  return Math.abs(a - b) < tolerance;
}

export function isNumberNode(node) {
  return node.type === 'number';
}

export function isVariableNode(node, variable) {
  return node.type === 'variable' && node.name === variable;
}

export function ensureNode(node) {
  if (!node) throw new Error('گره نامعتبر است.');
  return node;
}
