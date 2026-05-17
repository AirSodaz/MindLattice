import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const host = '127.0.0.1';
const port = Number.parseInt(process.env.MINDLATTICE_E2E_PORT ?? '5173', 10);
const appUrl = `http://${host}:${port}/`;
const browserExecutable = process.env.MINDLATTICE_E2E_BROWSER ?? findBrowserExecutable();
const chromeDebugPort = Number.parseInt(process.env.MINDLATTICE_E2E_CHROME_PORT ?? '9227', 10);
const chromeProfileDir = await mkdtemp(path.join(tmpdir(), 'mindlattice-e2e-chrome-'));

let viteProcess = null;
let chromeProcess = null;
let viteOutput = '';
let protocol = null;

try {
  if (!(await isAppServing())) {
    viteProcess = startVite();
    await waitForApp();
  }

  chromeProcess = startBrowser();
  protocol = await connectToBrowser();
  try {
    await runSmoke(protocol);
  } finally {
    await closeBrowserProtocol(protocol);
    protocol = null;
  }

  console.log('MindLattice browser e2e smoke passed.');
} finally {
  if (chromeProcess) {
    await stopProcess(chromeProcess);
  }
  if (viteProcess) {
    await stopProcess(viteProcess);
  }
  await removeWithRetry(chromeProfileDir);
}

async function runSmoke(protocol) {
  await protocol.send('Page.enable');
  await protocol.send('Runtime.enable');

  const consoleEntries = [];
  protocol.on('Runtime.consoleAPICalled', (params) => {
    const level = params.type === 'warning' ? 'warn' : params.type;
    if (level === 'error' || level === 'warn') {
      consoleEntries.push({
        level,
        text: params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '),
      });
    }
  });
  protocol.on('Runtime.exceptionThrown', (params) => {
    consoleEntries.push({
      level: 'error',
      text: params.exceptionDetails?.text ?? 'Runtime exception thrown',
    });
  });

  const pageLoaded = onceEvent(protocol, 'Page.loadEventFired');
  await protocol.send('Page.navigate', { url: appUrl });
  await pageLoaded;
  await evaluate(protocol, `window.localStorage.setItem('mindlattice.languagePreference', 'en')`);
  const englishReloaded = onceEvent(protocol, 'Page.loadEventFired');
  await protocol.send('Page.reload', { ignoreCache: true });
  await englishReloaded;
  await waitForText(protocol, 'Execution agent');
  await waitForText(protocol, 'Setup required');
  await waitForText(protocol, 'Provider setup');

  assert.equal(await getDocumentTitle(protocol), 'MindLattice');
  assert.equal(await locatorCount(protocol, 'main.app-shell'), 1);
  assert.equal(await locatorCount(protocol, '[aria-label="Turn context pane"]'), 1);
  assert.equal(await isAgentComposerDisabled(protocol), true);

  await fillByAriaLabel(protocol, 'Message the execution agent', 'Manual setup task');
  assert.equal(await isSendButtonDisabled(protocol), true);
  assert.equal(await bodyHasText(protocol, 'Created focus task: Manual setup task.'), false);

  await clickButton(protocol, 'Configure LLM');
  await waitForText(protocol, 'Provider setup');
  await waitForText(protocol, 'Required for the execution agent.');
  await fillByLabel(protocol, 'Model', 'mock-model');
  await fillByLabel(protocol, 'API key', 'local-key');
  await clickButton(protocol, 'Test connection');
  await waitForText(protocol, 'Connection test succeeded.');
  await clickButton(protocol, 'Save');
  await waitForText(protocol, 'LLM provider configured for local review.');
  await waitForText(protocol, 'Current focus');
  assert.equal(await locatorCount(protocol, '[aria-label="Star-map canvas"]'), 1);

  await clickButton(protocol, 'Settings');
  await waitForText(protocol, 'Agent Provider');
  await waitForText(protocol, 'Local Profile');
  await waitForText(protocol, 'Safety Boundary');
  await waitForText(protocol, 'Interface');
  await selectByLabel(protocol, 'Language preference', 'zh-CN');
  await waitForText(protocol, '语言偏好');
  await waitForText(protocol, 'Agent 设置与本地偏好');
  await selectByLabel(protocol, '语言偏好', 'en');
  await waitForText(protocol, 'Language preference');
  await clickInputByLabel(protocol, 'work');
  await clickInputByLabel(protocol, 'task initiation');
  await selectByLabel(protocol, 'Preferred support', 'task_structure');
  await clickButton(protocol, 'Save profile');
  await waitForText(protocol, 'Onboarding preferences saved for local support matching.');

  assert.equal(await isAgentComposerDisabled(protocol), false);

  await fillByAriaLabel(protocol, 'Message the execution agent', 'Break this down into one visible next action.');
  await clickElement(protocol, `document.querySelector('[aria-label="Send message"]')`);
  await waitForText(protocol, 'Preview drafted. Review it, revise it, or accept it before anything is saved.');
  await waitForText(protocol, 'Accepting will add 1 draft node');

  await fillByAriaLabel(protocol, 'Message the execution agent', 'Make the next action smaller.');
  await clickElement(protocol, `document.querySelector('[aria-label="Send message"]')`);
  await waitForText(protocol, 'Preview revised. Review it, revise it, or accept it before anything is saved.');
  await waitForText(protocol, 'Write one rough bullet');

  await clickButton(protocol, 'Accept');
  await waitForText(protocol, 'Write one rough bullet');

  await clickButton(protocol, 'Advanced map');
  await selectByLabel(protocol, 'Add nearby', 'blocker');
  await fillByPlaceholder(protocol, 'Name the nearby node', 'Missing source notes');
  await clickButton(protocol, 'Add node');
  await waitForText(protocol, 'Added blocker: Missing source notes.');
  await selectByLabel(protocol, 'Connect from', 'Plan launch notes');
  await selectByLabel(protocol, 'Connect to', 'Open the draft and write three bullets');
  await selectByLabel(protocol, 'Relationship', 'breaks_down_to');
  await clickButton(protocol, 'Connect nodes');
  await waitForText(protocol, 'Connected Plan launch notes to Open the draft and write three bullets.');

  await clickButton(protocol, 'Back to canvas');
  await clickButton(protocol, 'Support');
  await clickTemplateAction(protocol, 'Visible short checklist', 'Adopt');
  await waitForText(protocol, 'Support adopted: Visible short checklist.');
  await selectByLabel(protocol, 'Support tried', 'Visible short checklist');
  await fillByPlaceholder(protocol, 'Optional obstacle or adjustment note', 'Checklist made the return point visible.');
  await clickButton(protocol, 'Review experiment');
  await waitForText(protocol, 'Pending experiment');
  await clickButton(protocol, 'Accept experiment');
  await waitForText(protocol, 'Strategy experiment accepted: keep visible-checklist.');

  await clickButton(protocol, 'Back to canvas');
  await clickButton(protocol, 'Start');
  await fillByPlaceholder(protocol, 'Did you start, where did it get stuck, or what should stay visible next?', 'Five-minute starts helped me return.');
  await clickButton(protocol, 'Save check-in');
  await waitForText(protocol, 'Check-in saved: Five-minute starts helped me return.');
  await clickButton(protocol, 'Back to canvas');
  await clickButton(protocol, 'Memory');
  await clickButton(protocol, 'Accept memory');
  await waitForText(protocol, 'Preference memory accepted: Five-minute starts helped me return.');

  await clickButton(protocol, 'Back to canvas');
  await clickButton(protocol, 'Vault');
  await fillByLabel(protocol, 'Markdown content', '# Imported browser smoke note\\nKeep this beside the map.');
  await clickButton(protocol, 'Preview import');
  await waitForText(protocol, 'Pending import');
  await clickButton(protocol, 'Accept import');
  await waitForText(protocol, 'Vault import accepted: 1 node and 0 edges imported.');

  await clickButton(protocol, 'Back to canvas');
  await waitForText(protocol, 'Imported browser smoke note');
  await clickButton(protocol, 'Start');
  await clickButton(protocol, 'Enter Start Mode');
  await waitForText(protocol, 'Return to map');
  assert.equal(await locatorCount(protocol, '[aria-label="Focused Start Mode"]'), 1);
  assert.equal(await locatorCount(protocol, '[aria-label="Star-map canvas"]'), 0);

  await clickButton(protocol, 'Return to map');
  await waitForText(protocol, 'Current focus');
  assert.equal(await locatorCount(protocol, '[aria-label="Star-map canvas"]'), 1);

  const relevantConsoleEntries = consoleEntries.filter((entry) => !/Download the React DevTools/i.test(entry.text));
  assert.deepEqual(relevantConsoleEntries, []);
}

function startVite() {
  const viteBin = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [viteBin, '--host', host, '--port', String(port), '--strictPort'], {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  child.stdout?.on('data', (chunk) => {
    viteOutput += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    viteOutput += chunk.toString();
  });
  child.once('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      viteOutput += `\nVite exited with code ${code}.`;
    }
    if (signal) {
      viteOutput += `\nVite exited with signal ${signal}.`;
    }
  });
  return child;
}

function startBrowser() {
  return spawn(
    browserExecutable,
    [
      '--headless=new',
      `--remote-debugging-port=${chromeDebugPort}`,
      `--user-data-dir=${chromeProfileDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function connectToBrowser() {
  const websocketUrl = await waitForWebSocketUrl();
  return connectCdp(websocketUrl);
}

async function connectCdp(websocketUrl) {
  const websocket = new WebSocket(websocketUrl);
  const callbacks = new Map();
  const listeners = new Map();
  let nextId = 1;

  websocket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (!callback) {
        return;
      }
      if (message.error) {
        callback.reject(new Error(message.error.message));
      } else {
        callback.resolve(message.result ?? {});
      }
      return;
    }

    const methodListeners = listeners.get(message.method) ?? [];
    for (const listener of methodListeners) {
      listener(message.params ?? {});
    }
  });

  await new Promise((resolve, reject) => {
    websocket.addEventListener('open', resolve, { once: true });
    websocket.addEventListener('error', reject, { once: true });
  });

  return {
    on(method, listener) {
      listeners.set(method, [...(listeners.get(method) ?? []), listener]);
    },
    send(method, params = {}) {
      const id = nextId++;
      websocket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        callbacks.set(id, { resolve, reject });
      });
    },
    close() {
      websocket.close();
      return Promise.resolve();
    },
  };
}

async function closeBrowserProtocol(openProtocol) {
  try {
    await openProtocol.send('Browser.close');
  } catch {
    try {
      await openProtocol.close();
    } catch {
      // Process cleanup below is the final fallback.
    }
  }
  if (chromeProcess) {
    await waitForExit(chromeProcess, 5_000);
  }
}

async function stopProcess(child) {
  if (child.exitCode !== null) {
    return;
  }
  child.kill();
  await waitForExit(child, 5_000);
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return;
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(timeoutMs),
  ]);
}

async function removeWithRetry(directory) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error?.code !== 'EBUSY' && error?.code !== 'ENOTEMPTY' && error?.code !== 'EPERM') {
        throw error;
      }
      await delay(250 * (attempt + 1));
    }
  }
  await rm(directory, { recursive: true, force: true });
}

async function waitForWebSocketUrl() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${host}:${chromeDebugPort}/json/new?${encodeURIComponent(appUrl)}`, {
        method: 'PUT',
      });
      if (response.ok) {
        const target = await response.json();
        if (target.webSocketDebuggerUrl) {
          return target.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Keep polling until the browser debug endpoint is ready.
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for browser DevTools endpoint.');
}

async function waitForApp() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isAppServing()) {
      return;
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${appUrl}\n\nVite output:\n${viteOutput || '(no output captured)'}`);
}

async function isAppServing() {
  try {
    const response = await fetch(appUrl);
    return response.ok;
  } catch {
    return false;
  }
}

function onceEvent(protocol, method) {
  return new Promise((resolve) => {
    protocol.on(method, resolve);
  });
}

async function waitForText(protocol, text) {
  await waitForCondition(protocol, `document.body?.innerText.includes(${JSON.stringify(text)})`);
}

async function waitForCondition(protocol, expression) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await evaluate(protocol, expression)) {
      return;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for condition: ${expression}`);
}

async function getDocumentTitle(protocol) {
  return evaluate(protocol, 'document.title');
}

async function locatorCount(protocol, selector) {
  return evaluate(protocol, `document.querySelectorAll(${JSON.stringify(selector)}).length`);
}

async function isAgentComposerDisabled(protocol) {
  return evaluate(protocol, `document.querySelector('[aria-label="Message the execution agent"]')?.disabled ?? true`);
}

async function isSendButtonDisabled(protocol) {
  return evaluate(protocol, `document.querySelector('[aria-label="Send message"]')?.disabled ?? true`);
}

async function bodyHasText(protocol, text) {
  return evaluate(protocol, `document.body?.innerText.includes(${JSON.stringify(text)}) ?? false`);
}

async function fillByLabel(protocol, labelText, value) {
  await dispatchInput(protocol, `controlForLabel(${JSON.stringify(labelText)})`, value);
}

async function fillByAriaLabel(protocol, labelText, value) {
  await dispatchInput(protocol, `document.querySelector('[aria-label=${JSON.stringify(labelText)}]')`, value);
}

async function fillByPlaceholder(protocol, placeholder, value) {
  await dispatchInput(protocol, `document.querySelector('[placeholder=${JSON.stringify(placeholder)}]')`, value);
}

async function dispatchInput(protocol, targetExpression, value) {
  const escapedValue = JSON.stringify(value);
  await evaluate(
    protocol,
    `(() => {
      const target = ${targetExpression};
      if (!target) return false;
      target.focus();
      setElementValue(target, ${escapedValue});
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
  );
}

async function clickButton(protocol, text) {
  await clickElement(protocol, `buttonWithText(${JSON.stringify(text)})`);
}

async function clickInputByLabel(protocol, text) {
  await clickElement(protocol, `inputForLabelText(${JSON.stringify(text)})`);
}

async function selectByLabel(protocol, labelText, value) {
  const escapedValue = JSON.stringify(value);
  await evaluate(
    protocol,
    `(() => {
      const target = controlForLabel(${JSON.stringify(labelText)});
      if (!target) return false;
      const optionByValue = [...target.options].find((option) => option.value === ${escapedValue});
      const optionByText = [...target.options].find((option) => normalizedText(option) === ${escapedValue});
      const option = optionByValue ?? optionByText;
      if (!option) return false;
      setElementValue(target, option.value);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
  );
}

async function clickTemplateAction(protocol, headingText, buttonText) {
  await clickElement(protocol, `buttonInArticleWithHeading(${JSON.stringify(headingText)}, ${JSON.stringify(buttonText)})`);
}

async function clickElement(protocol, targetExpression) {
  const clicked = await evaluate(
    protocol,
    `(() => {
      const target = ${targetExpression};
      if (!target) return false;
      if (target.disabled) return 'disabled';
      target.click();
      return true;
    })()`,
  );
  assert.equal(clicked, true);
}

async function evaluate(protocol, expression) {
  const result = await protocol.send('Runtime.evaluate', {
    expression: `(() => {
      function normalizedText(node) {
        return (node?.textContent ?? '').replace(/\\s+/g, ' ').trim();
      }
      function buttonWithText(text) {
        return [...document.querySelectorAll('button')]
          .find((button) => normalizedText(button) === text);
      }
      function controlForLabel(text) {
        const label = [...document.querySelectorAll('label')]
          .find((item) => normalizedText(item).startsWith(text));
        return label?.querySelector('input, textarea, select') ?? null;
      }
      function inputForLabelText(text) {
        const label = [...document.querySelectorAll('label')]
          .find((item) => normalizedText(item) === text);
        return label?.querySelector('input') ?? null;
      }
      function buttonInArticleWithHeading(headingText, buttonText) {
        const article = [...document.querySelectorAll('article')]
          .find((item) => [...item.querySelectorAll('h1, h2, h3, h4')]
            .some((heading) => normalizedText(heading) === headingText));
        return [...(article?.querySelectorAll('button') ?? [])]
          .find((button) => normalizedText(button) === buttonText) ?? null;
      }
      function setElementValue(target, value) {
        const prototype = target instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : target instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        setter?.call(target, value);
      }
      return ${expression};
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed');
  }
  return result.result.value;
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('No supported Chrome or Edge executable found for browser smoke testing.');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
