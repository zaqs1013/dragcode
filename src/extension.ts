import * as vscode from 'vscode';
import axios from 'axios';
import { WebSocketServer } from 'ws';

let wss: WebSocketServer;

export function activate(context: vscode.ExtensionContext) {
  // 1) WS 서버 띄우기 (React 쪽과 통신용)
  wss = new WebSocketServer({ port: 9234 });
  console.log('▶ WS Server listening on ws://localhost:9234');
  wss.on('connection', ws => {
    console.log('🟢 React UI connected to WS');
  });

  // 2) 텍스트 선택이 변경될 때마다 React에 자동 전송
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(e => {
      const editor = e.textEditor;
      const code = editor.document.getText(editor.selection);
      const payload = JSON.stringify({ type: 'selection', code });
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(payload);
        }
      });
    })
  );

  // 3) Ctrl+Alt+G 로만 GPT 요청 보내기
  const disposable = vscode.commands.registerCommand(
    'dragcode.sendToServer',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return vscode.window.showErrorMessage('에디터가 열려 있지 않습니다.');
      }

      const code = editor.document.getText(editor.selection);
      if (!code) {
        return vscode.window.showWarningMessage('선택된 코드가 없습니다.');
      }

      // ▶ React에 'loading' 메시지 전송
      const loadingPayload = JSON.stringify({ type: 'loading' });
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(loadingPayload);
        }
      });


      // 상태 표시줄에 로딩 표시
      const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
      statusBar.text = '$(sync~spin) Sending to GPT…';
      statusBar.show();
      context.subscriptions.push(statusBar);

      // 설정에서 endpoint, timeout 읽어오기
      const config   = vscode.workspace.getConfiguration('dragcode');
      const endpoint = config.get<string>('endpoint')!;
      const timeout  = config.get<number>('timeout')!;

      let result: string;
      try {
        const { data } = await axios.post<{
          choices: Array<{ message: { content: string } }>
        }>(
          endpoint,
          { messages: [{ role: 'user', content: code }] },
          { headers: { 'Content-Type': 'application/json' }, timeout }
        );
        result = data.choices?.[0]?.message.content || '응답이 없습니다.';
      } catch (err: any) {
        result = `Error: ${err.message}`;
      } finally {
        statusBar.hide();
        statusBar.dispose();
      }

      // GPT 응답을 React에 전송
      const payload = JSON.stringify({ type: 'result', result });
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(payload);
        }
      });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  if (wss) {
    wss.close();
  }
}
