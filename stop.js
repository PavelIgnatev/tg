const childProcess = require('child_process');

// Получить список всех процессов Node.js
const processes = childProcess.execSync('pgrep -lfa "node"').toString().trim().split('\n');

// Остановить каждый процесс
processes.forEach((process) => {
  const pid = process.split(' ')[0];
  childProcess.spawnSync('kill', ['-9', pid]);
});

console.log('Все процессы Node.js остановлены.');
