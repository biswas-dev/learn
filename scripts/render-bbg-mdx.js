#!/usr/bin/env node
/**
 * Renders ByteByteGo compiled MDX (JSX) code to HTML.
 *
 * Usage: echo '{"code": "var Component=..."}' | node render-bbg-mdx.js
 * Output: HTML string to stdout
 */

const fs = require('fs');

const input = fs.readFileSync('/dev/stdin', 'utf-8');
const { code } = JSON.parse(input);

// Build a mock JSX runtime that produces HTML strings
function createElement(tag, props, ...children) {
  const allChildren = [];

  // Flatten children from props.children and direct children
  function flatten(c) {
    if (c == null || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(flatten); return; }
    allChildren.push(String(c));
  }

  if (props && props.children != null) {
    flatten(props.children);
  }
  children.forEach(flatten);

  const inner = allChildren.join('');

  if (typeof tag === 'function') {
    // Custom component - call it with props
    return tag({ ...props, children: inner });
  }

  if (tag === Symbol.for('react.fragment') || tag === 'fragment') {
    return inner;
  }

  // Build HTML attributes
  let attrs = '';
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'children' || k === 'key' || v == null) continue;
      if (k === 'className') {
        attrs += ` class="${escapeAttr(String(v))}"`;
      } else if (k === 'htmlFor') {
        attrs += ` for="${escapeAttr(String(v))}"`;
      } else if (typeof v === 'boolean') {
        if (v) attrs += ` ${k}`;
      } else {
        attrs += ` ${k}="${escapeAttr(String(v))}"`;
      }
    }
  }

  // Self-closing tags
  const voidTags = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);
  if (voidTags.has(tag)) {
    return `<${tag}${attrs} />`;
  }

  return `<${tag}${attrs}>${inner}</${tag}>`;
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Fragment symbol
const FragmentSymbol = Symbol.for('react.fragment');

// Mock JSX runtime
const _jsx_runtime = {
  jsx: createElement,
  jsxs: createElement,
  Fragment: FragmentSymbol,
};

// Custom components that BBG uses
function Figure(props) {
  const inner = props.children || '';
  const caption = props.caption || '';
  let html = `<figure class="bbg-figure">${inner}`;
  if (caption) {
    html += `<figcaption>${caption}</figcaption>`;
  }
  html += '</figure>';
  return html;
}

function ImageComponent(props) {
  const src = props.src || '';
  const alt = props.alt || '';
  let attrs = `src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"`;
  if (props.width) attrs += ` width="${escapeAttr(String(props.width))}"`;
  if (props.height) attrs += ` height="${escapeAttr(String(props.height))}"`;
  return `<img ${attrs} />`;
}

// Evaluate the code to extract the rendered content
try {
  // The code defines a Component factory. We need to:
  // 1. Provide _jsx_runtime
  // 2. Execute the code
  // 3. Call the default export function with our mock components

  const wrappedCode = `
    var _jsx_runtime = __runtime__;
    ${code}
    return Component;
  `;

  const factory = new Function('__runtime__', wrappedCode);
  const Component = factory(_jsx_runtime);

  // Component is a function that returns { default: renderFn, frontmatter: {...} }
  // or it could be the module itself
  let mod;
  if (typeof Component === 'function') {
    mod = Component();
  } else {
    mod = Component;
  }

  let renderFn = mod.default || mod;
  if (typeof renderFn !== 'function') {
    // Try to find it
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] === 'function' && key !== 'frontmatter') {
        renderFn = mod[key];
        break;
      }
    }
  }

  if (typeof renderFn !== 'function') {
    console.error('Could not find render function. Module keys:', Object.keys(mod));
    process.exit(1);
  }

  // CodeTabs: renders tabbed code blocks
  function CodeTabs(props) {
    const inner = props.children || '';
    return `<div class="bbg-code-tabs">${inner}</div>`;
  }
  function CodeTab(props) {
    const label = props.label || props.value || '';
    const inner = props.children || '';
    if (label) {
      return `<div class="bbg-code-tab"><div class="bbg-code-tab-label"><strong>${label}</strong></div>${inner}</div>`;
    }
    return inner;
  }

  // Catch-all: unknown components render their children as-is
  const componentProxy = new Proxy({
    Figure,
    Image: ImageComponent,
    CodeTabs,
    CodeTab,
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Return a passthrough component for any unknown custom component
      return function UnknownComponent(props) {
        return props.children || '';
      };
    }
  });

  // Build components map with known custom components.
  // The MDX code destructures these and throws if any are undefined,
  // so we need to pre-populate all possible component names.
  const knownComponents = {
    Figure,
    Image: ImageComponent,
    CodeTabs,
    CodeTab,
  };

  // Extract required component names from the code.
  // The MDX compiler generates guards like: `a||s("ComponentName",!0)`
  // where `s` can be any minified single-char function name.
  const componentNames = new Set();
  // Match: ||<any_fn>("ComponentName"  — catches all guard patterns
  const guardPattern = /\|\|\w+\("([A-Z]\w+)"/g;
  let m;
  while ((m = guardPattern.exec(code)) !== null) {
    componentNames.add(m[1]);
  }
  // Also match destructure: {Name:var,...}=e patterns
  const destructPattern = /\{([A-Z]\w+:\w+(?:,[A-Z]\w+:\w+)*)\}=\w/g;
  while ((m = destructPattern.exec(code)) !== null) {
    for (const pair of m[1].split(',')) {
      const name = pair.split(':')[0];
      if (name && /^[A-Z]/.test(name)) componentNames.add(name);
    }
  }

  // Create passthrough for any component not in our known set
  const passthrough = function(props) { return props.children || ''; };
  const components = { ...knownComponents };
  for (const name of componentNames) {
    if (!(name in components)) {
      components[name] = passthrough;
    }
  }

  const html = renderFn({ components });

  process.stdout.write(html);
} catch (err) {
  console.error('Error evaluating code:', err.message);
  console.error(err.stack);
  process.exit(1);
}
