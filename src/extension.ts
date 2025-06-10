import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer;

export function activate(context: vscode.ExtensionContext) {
  // 1) VS Code 시작 직후 WS 서버 띄우기
  wss = new WebSocketServer({ port: 12345 });
  console.log('🛰️ WS server running on ws://localhost:12345');

  // 2) 클라이언트 연결 시 로그
  wss.on('connection', (ws: WebSocket) => {
    console.log('🛰️ React client connected');
  });

  // 3) 에디터 선택이 바뀔 때마다 선택 코드 푸시
  vscode.window.onDidChangeTextEditorSelection(e => {
    const sel = e.textEditor.document.getText(e.selections[0]).trim();
    if (sel) {
      const payload = JSON.stringify({ code: sel });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          (client as WebSocket).send(payload);
        }
      }
    }
  });

  // (옵션) 기존 커맨드도 남겨둘 수 있습니다.
  const sendCmd = vscode.commands.registerCommand(
    'dragcode.sendSelection',
    async () => {
      vscode.window.showInformationMessage('Selection sent via WS.');
    }
  );
  context.subscriptions.push(sendCmd);
}

export function deactivate() {
  wss?.close();
}
