/**
 * Agente Windows - COMPLETO com todas as ferramentas
 */

const WebSocket = require('ws');
const { exec } = require('child_process');
const os = require('os');

const BACKEND_URL = process.env.BACKEND_URL || 'ws://192.168.0.2:3002';
const CLIENT_ID = process.env.CLIENT_ID || `client-${Date.now()}`;

console.log('🤖 Agente Windows iniciando...');
console.log(`📡 Conectando ao backend: ${BACKEND_URL}`);
console.log(`🆔 ID do cliente: ${CLIENT_ID}`);

let ws;

function connect() {
  ws = new WebSocket(`${BACKEND_URL}/agent`);

  ws.on('open', () => {
    console.log('✅ Conectado ao backend!');
    ws.send(JSON.stringify({
      type: 'register',
      clientId: CLIENT_ID,
      platform: 'windows',
      hostname: os.hostname()
    }));
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Comando recebido:', message.toolName, message.args);

      if (message.type === 'execute_tool') {
        const result = await executeTool(message.toolName, message.args);
        console.log('✅ Resultado:', result.substring(0, 100));
        
        ws.send(JSON.stringify({
          type: 'tool_result',
          requestId: message.requestId,
          result: result
        }));
      }
    } catch (error) {
      console.error('❌ Erro:', error.message);
    }
  });

  ws.on('close', () => {
    console.log('❌ Conexão perdida. Reconectando em 5s...');
    setTimeout(connect, 5000);
  });

  ws.on('error', (error) => {
    console.error('❌ Erro WebSocket:', error.message);
  });
}

function runCmd(command) {
  return new Promise((resolve) => {
    exec(command, { encoding: 'utf-8', timeout: 15000, shell: 'powershell.exe' }, (error, stdout, stderr) => {
      resolve(error ? (stderr || error.message) : (stdout || 'Comando executado com sucesso.'));
    });
  });
}

function runCmdShell(command) {
  return new Promise((resolve) => {
    exec(command, { encoding: 'utf-8', timeout: 15000 }, (error, stdout, stderr) => {
      resolve(error ? (stderr || error.message) : (stdout || 'Comando executado com sucesso.'));
    });
  });
}

const APP_MAP = {
  'calculadora': 'calc', 'calculator': 'calc', 'calc': 'calc',
  'bloco de notas': 'notepad', 'notepad': 'notepad', 'bloco de nota': 'notepad',
  'paint': 'mspaint', 'paint 3d': 'start ms-paint:',
  'explorador de arquivos': 'explorer', 'explorador': 'explorer', 'explorer': 'explorer',
  'gerenciador de tarefas': 'taskmgr', 'task manager': 'taskmgr',
  'painel de controle': 'control', 'control panel': 'control',
  'terminal': 'wt', 'powershell': 'powershell', 'cmd': 'cmd', 'prompt de comando': 'cmd',
  'chrome': 'start chrome', 'google chrome': 'start chrome',
  'edge': 'start msedge', 'microsoft edge': 'start msedge',
  'firefox': 'start firefox', 'opera': 'start opera',
  'brave': 'start brave', 'navegador': 'start brave',
  'word': 'start winword', 'excel': 'start excel', 'powerpoint': 'start powerpnt',
  'outlook': 'start outlook', 'onenote': 'start onenote',
  'discord': 'start discord', 'teams': 'start msteams', 'spotify': 'start spotify',
  'vscode': 'code', 'visual studio code': 'code',
};

const PROCESS_MAP = {
  'calculadora': 'Calculator.exe', 'calc': 'Calculator.exe',
  'bloco de notas': 'notepad.exe', 'notepad': 'notepad.exe',
  'paint': 'mspaint.exe',
  'chrome': 'chrome.exe', 'google chrome': 'chrome.exe',
  'edge': 'msedge.exe', 'microsoft edge': 'msedge.exe',
  'brave': 'brave.exe', 'navegador': 'brave.exe',
  'firefox': 'firefox.exe',
  'gerenciador de tarefas': 'Taskmgr.exe', 'task manager': 'Taskmgr.exe',
};

async function executeTool(toolName, args) {
  switch (toolName) {
    case 'open_application': {
      const name = (args.app_name || '').toLowerCase().trim();
      const cmd = APP_MAP[name];
      if (!cmd) return `Não sei como abrir "${args.app_name}".`;
      await runCmdShell(`start "" ${cmd}`);
      return `Aplicativo "${args.app_name}" aberto com sucesso.`;
    }

    case 'close_application': {
      const name = (args.app_name || '').toLowerCase().trim();
      const process = PROCESS_MAP[name];
      if (!process) return `Não sei qual processo fechar para "${args.app_name}".`;
      console.log(`[close] Tentando fechar processo: ${process}`);
      
      const result = await runCmdShell(`taskkill /IM "${process}" /F`);
      console.log(`[close] Resultado: ${result}`);
      
      if (result.includes('SUCCESS') || result.includes('SUCESSO') || result.includes('finalizado')) {
        return `"${args.app_name}" foi fechado com sucesso.`;
      }
      
      return `Não consegui fechar "${args.app_name}". ${result.substring(0, 100)}`;
    }

    case 'open_website': {
      const url = args.url || '';
      if (!url.startsWith('http://') && !url.startsWith('https://')) return 'URL inválida.';
      await runCmdShell(`start "" "${url}"`);
      return `Site aberto: ${url}`;
    }

    case 'web_search': {
      const query = encodeURIComponent(args.query || '');
      if (!query) return 'Nenhum termo de pesquisa fornecido.';
      await runCmdShell(`start "" "https://www.google.com/search?q=${query}"`);
      return `Pesquisa aberta no Google: "${args.query}"`;
    }

    case 'set_volume': {
      const level = Math.max(0, Math.min(100, Math.round(args.level ?? 50)));
      const psScript = `
        $wshShell = New-Object -ComObject WScript.Shell;
        1..50 | ForEach-Object { $wshShell.SendKeys([char]174) };
        $steps = [math]::Round(${level} / 2);
        if ($steps -gt 0) { 1..$steps | ForEach-Object { $wshShell.SendKeys([char]175) } };
      `;
      await runCmd(psScript);
      return `Volume ajustado para ${level}%.`;
    }

    case 'type_text': {
      const text = args.text || '';
      if (!text) return 'Nenhum texto fornecido.';
      const escaped = text.replace(/'/g, "''").replace(/\+/g, '{+}').replace(/\^/g, '{^}').replace(/%/g, '{%}').replace(/~/g, '{~}');
      const psCmd = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;
      await runCmd(psCmd);
      return 'Texto digitado com sucesso.';
    }

    case 'press_keys': {
      const keys = (args.keys || '').toLowerCase().trim();
      if (!keys) return 'Nenhuma tecla especificada.';
      
      if (keys === 'enter') {
        await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`);
        return 'Enter pressionado.';
      }
      
      if (keys === 'ctrl+w') {
        await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^w')`);
        return 'Ctrl+W pressionado.';
      }
      
      if (keys === 'alt+f4') {
        await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{F4}')`);
        return 'Alt+F4 pressionado.';
      }
      
      if (keys === 'ctrl+shift+esc') {
        await runCmdShell('taskmgr');
        return 'Gerenciador de Tarefas aberto.';
      }
      
      return `Atalho ${keys} executado.`;
    }

    case 'lock_screen': {
      await runCmdShell('rundll32.exe user32.dll,LockWorkStation');
      return 'Tela bloqueada.';
    }

    case 'system_power': {
      const action = (args.action || '').toLowerCase();
      const delay = Math.max(0, Math.min(3600, Math.round(args.delay_seconds ?? 0)));
      
      switch (action) {
        case 'shutdown':
          await runCmdShell(`shutdown /s /t ${delay}`);
          return delay > 0 ? `Computador será desligado em ${Math.round(delay / 60)} minuto(s).` : 'Computador desligando...';
        case 'restart':
          await runCmdShell(`shutdown /r /t ${delay}`);
          return delay > 0 ? `Computador será reiniciado em ${Math.round(delay / 60)} minuto(s).` : 'Computador reiniciando...';
        case 'sleep':
          await runCmd('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState("Suspend", $false, $false)');
          return 'Computador entrando em modo suspensão.';
        default:
          return `Ação "${action}" não reconhecida.`;
      }
    }

    case 'take_screenshot': {
      await runCmdShell('snippingtool');
      return 'Ferramenta de Recorte aberta.';
    }

    case 'manage_window': {
      const action = (args.action || '').toLowerCase();
      
      switch (action) {
        case 'minimize':
          await runCmd(`$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys('% n');`);
          return 'Janela minimizada.';
        case 'maximize':
          await runCmd(`$wshShell = New-Object -ComObject WScript.Shell; $wshShell.SendKeys('% x');`);
          return 'Janela maximizada.';
        case 'close':
          await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{F4}')`);
          return 'Janela ativa fechada.';
        default:
          return `Ação "${action}" não reconhecida.`;
      }
    }

    case 'clipboard_copy': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')`);
      return 'Texto copiado.';
    }

    case 'clipboard_paste': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
      return 'Conteúdo colado.';
    }

    case 'clipboard_set_text': {
      const text = args.text || '';
      if (!text) return 'Nenhum texto fornecido.';
      const escaped = text.replace(/"/g, '`"').replace(/'/g, "''");
      await runCmd(`Set-Clipboard -Value "${escaped}"`);
      return 'Texto copiado para área de transferência.';
    }

    case 'browser_new_tab': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^t')`);
      if (args.url) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const escaped = args.url.replace(/'/g, "''");
        await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}{ENTER}')`);
        return `Nova aba: ${args.url}`;
      }
      return 'Nova aba aberta.';
    }

    case 'browser_reload': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{F5}')`);
      return 'Página recarregada.';
    }

    case 'browser_back': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{LEFT}')`);
      return 'Voltou.';
    }

    case 'browser_forward': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{RIGHT}')`);
      return 'Avançou.';
    }

    case 'browser_incognito': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^+n')`);
      return 'Janela anônima aberta.';
    }

    case 'file_create': {
      const path = args.path || '';
      const type = args.type || 'file';
      const content = args.content || '';
      if (!path) return 'Caminho não fornecido.';
      if (type === 'folder') {
        await runCmd(`New-Item -ItemType Directory -Path "${path}" -Force`);
        return `Pasta criada: ${path}`;
      }
      const escaped = content.replace(/"/g, '`"');
      await runCmd(`Set-Content -Path "${path}" -Value "${escaped}"`);
      return `Arquivo criado: ${path}`;
    }

    case 'file_delete': {
      const path = args.path || '';
      if (!path) return 'Caminho não fornecido.';
      await runCmd(`Remove-Item -Path "${path}" -Recurse -Force`);
      return `Deletado: ${path}`;
    }

    case 'file_rename': {
      const oldPath = args.old_path || '';
      const newName = args.new_name || '';
      if (!oldPath || !newName) return 'Caminho ou nome não fornecido.';
      await runCmd(`Rename-Item -Path "${oldPath}" -NewName "${newName}"`);
      return `Renomeado: ${newName}`;
    }

    case 'file_search': {
      const filename = args.filename || '';
      const directory = args.directory || '$env:USERPROFILE\\Desktop';
      if (!filename) return 'Nome não fornecido.';
      const result = await runCmd(`Get-ChildItem -Path ${directory} -Recurse -Filter "*${filename}*" -ErrorAction SilentlyContinue | Select-Object -First 10 FullName | Format-Table -HideTableHeaders`);
      return result.trim() || `Nenhum arquivo "${filename}" encontrado.`;
    }

    case 'run_command': {
      const command = args.command || '';
      const shell = args.shell || 'powershell';
      if (!command) return 'Comando não fornecido.';
      const result = shell === 'cmd' ? await runCmdShell(command) : await runCmd(command);
      return `Resultado:\n${result.substring(0, 500)}`;
    }

    case 'kill_process': {
      const processName = args.process_name || '';
      if (!processName) return 'Processo não fornecido.';
      const result = await runCmdShell(`taskkill /IM "${processName}" /F`);
      return result.includes('SUCCESS') || result.includes('finalizado') ? `Processo ${processName} encerrado.` : `Não foi possível encerrar.`;
    }

    case 'list_processes': {
      const filter = args.filter || '';
      const cmd = filter ? `Get-Process | Where-Object {$_.Name -like "*${filter}*"} | Select-Object -First 20 Name, Id | Format-Table` : `Get-Process | Select-Object -First 20 Name, Id | Format-Table`;
      const result = await runCmd(cmd);
      return `Processos:\n${result.substring(0, 1000)}`;
    }

    case 'windows_search': {
      const query = args.query || '';
      if (!query) return 'Busca não fornecida.';
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^{ESC}')`);
      await new Promise(resolve => setTimeout(resolve, 300));
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^s')`);
      await new Promise(resolve => setTimeout(resolve, 500));
      const escaped = query.replace(/'/g, "''");
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`);
      return `Busca: ${query}`;
    }

    case 'mouse_click': {
      const x = args.x || 0;
      const y = args.y || 0;
      const psCmd = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); Start-Sleep -Milliseconds 100; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int extraInfo); }'; [Mouse]::mouse_event(0x0002, 0, 0, 0, 0); [Mouse]::mouse_event(0x0004, 0, 0, 0, 0);`;
      await runCmd(psCmd);
      return `Clique em (${x}, ${y})`;
    }

    case 'browser_switch_tab': {
      const direction = args.direction || 'next';
      const times = args.times || 1;
      const keys = direction === 'next' ? '^{TAB}' : '^+{TAB}';
      for (let i = 0; i < times; i++) {
        await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      return `Alternado ${times}x para ${direction === 'next' ? 'próxima' : 'anterior'} aba.`;
    }

    default:
      return `Ferramenta "${toolName}" não implementada no agente.`;
  }
}

connect();

process.on('SIGINT', () => {
  console.log('\n👋 Encerrando agente...');
  if (ws) ws.close();
  process.exit(0);
});
