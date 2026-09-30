// Starts the API's browser-test server (api/tests/browser_server.py) on 8766 from the sibling api/ folder.
// Set QANINJA_API_DIR to use an API checkout elsewhere, and PYTHON_EXECUTABLE to choose the interpreter.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const api = path.resolve(process.env.QANINJA_API_DIR || path.join(__dirname, '../../api'));
const python = process.env.PYTHON_EXECUTABLE || ['venv/bin/python', '.venv/bin/python'].map(name => path.join(api, name)).find(name => fs.existsSync(name)) || 'python3';
const child = spawn(python, [path.join(api, 'tests/browser_server.py')], { stdio: 'inherit', env: { ...process.env, PYTHONPATH: api } });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code || 0));
