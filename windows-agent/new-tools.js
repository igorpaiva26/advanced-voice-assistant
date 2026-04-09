// NOVAS IMPLEMENTAÇÕES - Adicionar no switch do agent.js

    // ─── CLIPBOARD ─────────────────────────────────────────────────
    case 'clipboard_copy': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')`);
      return 'Texto copiado para área de transferência.';
    }

    case 'clipboard_paste': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
      return 'Conteúdo colado da área de transferência.';
    }

    case 'clipboard_set_text': {
      const text = args.text || '';
      if (!text) return 'Nenhum texto fornecido.';
      const escaped = text.replace(/"/g, '`"').replace(/'/g, "''");
      await runCmd(`Set-Clipboard -Value "${escaped}"`);
      return `Texto copiado para área de transferência: "${text.substring(0, 50)}..."`;
    }

    // ─── MOUSE ─────────────────────────────────────────────────────
    case 'mouse_click': {
      const button = args.button || 'left';
      const x = args.x;
      const y = args.y;
      
      let psScript = `Add-Type -AssemblyName System.Windows.Forms; `;
      
      if (x !== undefined && y !== undefined) {
        psScript += `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); `;
      }
      
      if (button === 'left') {
        psScript += `[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`;
      } else if (button === 'right') {
        psScript += `[System.Windows.Forms.SendKeys]::SendWait('+{F10}')`;
      } else if (button === 'double') {
        psScript += `[System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 100; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`;
      }
      
      await runCmd(psScript);
      return `Clique ${button} executado${x !== undefined ? ` em (${x}, ${y})` : ''}.`;
    }

    // ─── ARQUIVOS ──────────────────────────────────────────────────
    case 'file_create': {
      const path = args.path || '';
      const type = args.type || 'file';
      const content = args.content || '';
      
      if (!path) return 'Caminho não fornecido.';
      
      if (type === 'folder') {
        await runCmd(`New-Item -ItemType Directory -Path "${path}" -Force`);
        return `Pasta criada: ${path}`;
      } else {
        const escaped = content.replace(/"/g, '`"');
        await runCmd(`Set-Content -Path "${path}" -Value "${escaped}"`);
        return `Arquivo criado: ${path}`;
      }
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
      if (!oldPath || !newName) return 'Caminho ou novo nome não fornecido.';
      await runCmd(`Rename-Item -Path "${oldPath}" -NewName "${newName}"`);
      return `Renomeado para: ${newName}`;
    }

    case 'file_search': {
      const filename = args.filename || '';
      const directory = args.directory || '%USERPROFILE%\\Desktop';
      if (!filename) return 'Nome do arquivo não fornecido.';
      const result = await runCmd(`Get-ChildItem -Path "${directory}" -Recurse -Filter "*${filename}*" -ErrorAction SilentlyContinue | Select-Object -First 10 FullName | Format-Table -HideTableHeaders`);
      return result.trim() || `Nenhum arquivo encontrado com "${filename}" em ${directory}`;
    }

    // ─── NAVEGADOR ─────────────────────────────────────────────────
    case 'browser_new_tab': {
      const url = args.url;
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^t')`);
      if (url) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await type_text({ text: url });
        await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`);
        return `Nova aba aberta com: ${url}`;
      }
      return 'Nova aba aberta.';
    }

    case 'browser_reload': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{F5}')`);
      return 'Página recarregada.';
    }

    case 'browser_back': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{LEFT}')`);
      return 'Voltou para página anterior.';
    }

    case 'browser_forward': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{RIGHT}')`);
      return 'Avançou para próxima página.';
    }

    case 'browser_incognito': {
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^+n')`);
      return 'Janela anônima aberta.';
    }

    // ─── SISTEMA ───────────────────────────────────────────────────
    case 'run_command': {
      const command = args.command || '';
      const shell = args.shell || 'powershell';
      if (!command) return 'Comando não fornecido.';
      
      const result = shell === 'cmd' 
        ? await runCmdShell(command)
        : await runCmd(command);
      
      return `Resultado:\n${result.substring(0, 500)}`;
    }

    case 'kill_process': {
      const processName = args.process_name || '';
      if (!processName) return 'Nome do processo não fornecido.';
      const result = await runCmdShell(`taskkill /IM "${processName}" /F`);
      return result.includes('SUCCESS') || result.includes('finalizado') 
        ? `Processo ${processName} encerrado.`
        : `Não foi possível encerrar ${processName}.`;
    }

    case 'list_processes': {
      const filter = args.filter || '';
      const cmd = filter 
        ? `Get-Process | Where-Object {$_.Name -like "*${filter}*"} | Select-Object -First 20 Name, Id, CPU | Format-Table`
        : `Get-Process | Select-Object -First 20 Name, Id, CPU | Format-Table`;
      const result = await runCmd(cmd);
      return `Processos ativos:\n${result.substring(0, 1000)}`;
    }

    // ─── BUSCA ─────────────────────────────────────────────────────
    case 'windows_search': {
      const query = args.query || '';
      if (!query) return 'Termo de busca não fornecido.';
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^{ESC}')`);
      await new Promise(resolve => setTimeout(resolve, 300));
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^s')`);
      await new Promise(resolve => setTimeout(resolve, 500));
      const escaped = query.replace(/'/g, "''");
      await runCmd(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`);
      return `Busca do Windows aberta para: ${query}`;
    }
