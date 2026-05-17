import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCommandClient,
  createMockCommandClient,
  createTauriCommandClient,
  mapSnapshotToWorkbenchNodes,
} from './commandClient';

test('mock command client opens workspace and returns typed map snapshot', async () => {
  const client = createMockCommandClient();
  const workspace = await client.workspaceOpenDefault();
  const snapshot = await client.mapGet(workspace.id);

  assert.equal(workspace.title, 'Default workspace');
  assert.equal(snapshot.workspace.id, workspace.id);
  assert.equal(snapshot.nodes[0].kind, 'task');
});

test('mock agent turn returns preview without mutating persisted map', async () => {
  const client = createMockCommandClient();
  const workspace = await client.workspaceOpenDefault();
  const before = await client.mapGet(workspace.id);

  const response = await client.agentTurnSubmit(workspace.id, before.nodes[0].id, 'Break this down');
  const after = await client.mapGet(workspace.id);

  assert.equal(response.preview.proposedNodes.length, 1);
  assert.deepEqual(after.nodes, before.nodes);
});

test('accepting preview persists proposed nodes and clears active preview', async () => {
  const client = createMockCommandClient();
  const workspace = await client.workspaceOpenDefault();
  const response = await client.agentTurnSubmit(workspace.id, null, 'Break this down');

  await client.agentPreviewAccept(workspace.id, response.preview.id);
  const snapshot = await client.mapGet(workspace.id);
  const preview = await client.agentPreviewGet(response.preview.id);

  assert.equal(snapshot.nodes.some((node) => node.id === 'draft-next-2'), true);
  assert.equal(preview, null);
});

test('revising preview replaces the active draft without mutating persisted map', async () => {
  const client = createMockCommandClient();
  const workspace = await client.workspaceOpenDefault();
  const before = await client.mapGet(workspace.id);
  const response = await client.agentTurnSubmit(workspace.id, before.nodes[0].id, 'Break this down');

  const revised = await client.agentPreviewRevise(workspace.id, response.preview.id, 'Only keep one tiny step');
  const after = await client.mapGet(workspace.id);

  assert.equal(revised.kind, 'PreviewProposed');
  assert.equal(revised.preview.id, 'preview-2');
  assert.equal(revised.preview.proposedNodes[0].title, 'Write one rough bullet');
  assert.equal(await client.agentPreviewGet(response.preview.id), null);
  assert.equal((await client.agentPreviewGet(revised.preview.id)).id, 'preview-2');
  assert.deepEqual(after.nodes, before.nodes);
});

test('maps command DTOs into stable workbench node positions', () => {
  const nodes = mapSnapshotToWorkbenchNodes({
    workspace: { id: 'default-workspace', title: 'Default workspace' },
    nodes: [
      {
        id: 'task-1',
        workspaceId: 'default-workspace',
        kind: 'task',
        title: 'Task',
        body: null,
        metadata: null,
        position: { x: 55, y: 44 },
      },
      { id: 'next-1', workspaceId: 'default-workspace', kind: 'next_action', title: 'Next', body: null, metadata: null },
    ],
    edges: [],
  });

  assert.equal(nodes[0].x, 55);
  assert.equal(nodes[0].y, 44);
  assert.equal(nodes[1].kind, 'next_action');
});

test('maps command node body into workbench nodes for editable supports', () => {
  const nodes = mapSnapshotToWorkbenchNodes({
    workspace: { id: 'default-workspace', title: 'Default workspace' },
    nodes: [
      {
        id: 'support-1',
        workspaceId: 'default-workspace',
        kind: 'support',
        title: 'Visible short checklist',
        body: 'Keep two visible steps and stop at the minimum-done line.',
        metadata: null,
      },
    ],
    edges: [],
  });

  assert.equal(nodes[0].body, 'Keep two visible steps and stop at the minimum-done line.');
});

test('default command client uses mock transport outside Tauri runtime', async () => {
  const client = createCommandClient({ isTauri: false });

  const workspace = await client.workspaceOpenDefault();

  assert.equal(workspace.id, 'default-workspace');
});

test('Tauri command client invokes documented command names with typed arguments', async () => {
  const calls = [];
  const client = createTauriCommandClient(async (command, args) => {
    calls.push({ command, args });
    if (command === 'workspace_open_default') {
      return { id: 'workspace-1', title: 'Workspace' };
    }
    if (command === 'map_get') {
      return { workspace: { id: args.workspaceId, title: 'Workspace' }, nodes: [], edges: [] };
    }
    if (command === 'agent_turn_submit') {
      return { kind: 'ShortAnswer', message: 'No preview.', preview: null };
    }
    return undefined;
  });

  await client.workspaceOpenDefault();
  await client.mapGet('workspace-1');
  await client.nodeMove('node-1', 42.5, 61.25);
  await client.nodeUpdate('node-1', 'subtask', 'Draft launch outline', 'Keep this rough.');
  await client.edgeDelete('edge-1');
  await client.agentTurnSubmit('workspace-1', 'node-1', 'Break this down');
  await client.agentPreviewRevise('workspace-1', 'preview-1', 'Only keep one tiny step');
  await client.startPlanGet('workspace-1', 'next-1');
  await client.attentionSessionClose('session-1', '2026-05-17T00:05:00Z', 'Stopped at three rough bullets.');
  await client.vaultExport('workspace-1');
  await client.vaultImport('workspace-1', [{ filename: 'Imported.md', content: '# Imported\nBody.' }]);

  assert.deepEqual(calls, [
    { command: 'workspace_open_default', args: undefined },
    { command: 'map_get', args: { workspaceId: 'workspace-1' } },
    { command: 'node_move', args: { nodeId: 'node-1', x: 42.5, y: 61.25 } },
    {
      command: 'node_update',
      args: { nodeId: 'node-1', kind: 'subtask', title: 'Draft launch outline', body: 'Keep this rough.' },
    },
    { command: 'edge_delete', args: { edgeId: 'edge-1' } },
    {
      command: 'agent_turn_submit',
      args: { workspaceId: 'workspace-1', selectedNodeId: 'node-1', message: 'Break this down' },
    },
    {
      command: 'agent_preview_revise',
      args: { workspaceId: 'workspace-1', previewId: 'preview-1', message: 'Only keep one tiny step' },
    },
    { command: 'start_plan_get', args: { workspaceId: 'workspace-1', nextActionId: 'next-1' } },
    {
      command: 'attention_session_close',
      args: {
        sessionId: 'session-1',
        endedAt: '2026-05-17T00:05:00Z',
        completionNote: 'Stopped at three rough bullets.',
      },
    },
    { command: 'vault_export', args: { workspaceId: 'workspace-1' } },
    {
      command: 'vault_import',
      args: { workspaceId: 'workspace-1', files: [{ filename: 'Imported.md', content: '# Imported\nBody.' }] },
    },
  ]);
});

test('Tauri command client invokes full shell command surface for phase-one data types', async () => {
  const calls = [];
  const client = createTauriCommandClient(async (command, args) => {
    calls.push({ command, args });
    return undefined;
  });
  const experiment = {
    id: 'experiment-1',
    supportTemplateId: 'visible-checklist',
    customSupportTitle: null,
    context: 'work',
    helpedStart: true,
    helpedContinue: false,
    helpedReturn: true,
    helpedClarifyNextAction: true,
    obstacleNote: 'Interruptions broke the first attempt.',
    nextDecision: 'revise',
  };
  const profile = {
    id: 'profile-1',
    workspaceId: 'workspace-1',
    adultContexts: ['work'],
    executionDifficulties: ['task switching'],
    preferredSupportCategories: ['task_structure'],
    llmProviderSetupState: 'configured',
  };
  const memory = {
    id: 'memory-1',
    proposedMemoryText: 'Prefer visible short checklists.',
    evidenceReference: 'check-in-1',
  };

  await client.nodeCreate('workspace-1', 'task', 'Draft outline');
  await client.edgeCreate('workspace-1', 'task-1', 'next-1', 'breaks_down_to');
  await client.supportTemplatesList();
  await client.supportAdopt('workspace-1', 'visible-checklist');
  await client.strategyCardsList();
  await client.strategyExperimentCreate(experiment);
  await client.attentionSessionStart('next-1', 5, '2026-05-17T00:00:00Z');
  await client.contextProfileGet('workspace-1');
  await client.contextProfileUpdate(profile);
  await client.agentMemoryList('workspace-1');
  await client.agentMemoryUpdate('workspace-1', memory);
  await client.agentMemoryDelete('workspace-1', 'memory-1');
  await client.checkInCreate('workspace-1', 'next-1', 'Started with the smallest visible step.');
  await client.checkInList('workspace-1');
  await client.settingsUpdateLlm('http://localhost:11434/v1', 'local-key', 'llama3.2', 30);

  assert.deepEqual(calls, [
    { command: 'node_create', args: { workspaceId: 'workspace-1', kind: 'task', title: 'Draft outline' } },
    {
      command: 'edge_create',
      args: { workspaceId: 'workspace-1', sourceId: 'task-1', targetId: 'next-1', kind: 'breaks_down_to' },
    },
    { command: 'support_templates_list', args: undefined },
    { command: 'support_adopt', args: { workspaceId: 'workspace-1', templateId: 'visible-checklist' } },
    { command: 'strategy_cards_list', args: undefined },
    { command: 'strategy_experiment_create', args: { experiment } },
    {
      command: 'attention_session_start',
      args: {
        nextActionId: 'next-1',
        intendedDurationMinutes: 5,
        startedAt: '2026-05-17T00:00:00Z',
      },
    },
    { command: 'context_profile_get', args: { workspaceId: 'workspace-1' } },
    { command: 'context_profile_update', args: { profile } },
    { command: 'agent_memory_list', args: { workspaceId: 'workspace-1' } },
    { command: 'agent_memory_update', args: { workspaceId: 'workspace-1', memory } },
    { command: 'agent_memory_delete', args: { workspaceId: 'workspace-1', memoryId: 'memory-1' } },
    {
      command: 'check_in_create',
      args: {
        workspaceId: 'workspace-1',
        nodeId: 'next-1',
        body: 'Started with the smallest visible step.',
      },
    },
    { command: 'check_in_list', args: { workspaceId: 'workspace-1' } },
    {
      command: 'settings_update_llm',
      args: {
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'local-key',
        model: 'llama3.2',
        timeoutSeconds: 30,
      },
    },
  ]);
});

test('mock vault import and export use Markdown-shaped file DTOs', async () => {
  const client = createMockCommandClient();
  const workspace = await client.workspaceOpenDefault();

  const exported = await client.vaultExport(workspace.id);
  const imported = await client.vaultImport(workspace.id, [
    { filename: 'Imported.md', content: '# Imported\nKeep this reference.' },
  ]);

  assert.equal(exported.files[0].filename, 'Plan launch notes.md');
  assert.equal(exported.files[0].content.includes('mindlattice_id: task-1'), true);
  assert.equal(imported.nodesCreated, 1);
  assert.equal(imported.nodes[0].title, 'Imported');
});

test('mock command client lists persisted check-ins for review', async () => {
  const client = createMockCommandClient();
  const workspace = await client.workspaceOpenDefault();

  const first = await client.checkInCreate(workspace.id, 'next-1', 'Started with the smallest visible step.');
  const second = await client.checkInCreate(workspace.id, null, 'Returning needs the outline visible.');

  assert.deepEqual(await client.checkInList(workspace.id), [first, second]);
});

test('mock vault folder methods keep non-Tauri previews deterministic', async () => {
  const client = createMockCommandClient();
  const workspace = await client.workspaceOpenDefault();

  const importedFiles = await client.vaultPickImportFolder();
  const exportedFolder = await client.vaultExportToFolder(workspace.id);

  assert.deepEqual(importedFiles, []);
  assert.deepEqual(exportedFolder, { directory: 'mock-vault', filesWritten: 2 });
});

test('Tauri command client reads Markdown files from a selected Vault folder', async () => {
  const readPaths = [];
  const client = createTauriCommandClient(async () => undefined, {
    joinPath: async (...parts) => parts.join('/'),
    openDialog: async (options) => {
      assert.deepEqual(options, {
        directory: true,
        multiple: false,
        recursive: false,
        title: 'Choose Markdown import folder',
      });
      return 'C:/Vault';
    },
    readDir: async (directory) => {
      assert.equal(directory, 'C:/Vault');
      return [
        { isFile: true, name: 'Plan.md' },
        { isFile: true, name: 'ignore.txt' },
        { isDirectory: true, name: 'Archive' },
      ];
    },
    readTextFile: async (path) => {
      readPaths.push(path);
      return '# Plan\nBody.';
    },
  });

  const files = await client.vaultPickImportFolder();

  assert.deepEqual(readPaths, ['C:/Vault/Plan.md']);
  assert.deepEqual(files, [{ filename: 'Plan.md', content: '# Plan\nBody.' }]);
});

test('Tauri command client exports Markdown files into a selected Vault folder', async () => {
  const writtenFiles = [];
  const client = createTauriCommandClient(
    async (command, args) => {
      assert.deepEqual({ command, args }, { command: 'vault_export', args: { workspaceId: 'workspace-1' } });
      return {
        files: [
          { filename: 'Plan.md', content: '# Plan' },
          { filename: 'Next.md', content: '# Next' },
        ],
      };
    },
    {
      joinPath: async (...parts) => parts.join('/'),
      openDialog: async (options) => {
        assert.deepEqual(options, {
          canCreateDirectories: true,
          directory: true,
          multiple: false,
          title: 'Choose Markdown export folder',
        });
        return 'C:/Vault';
      },
      writeTextFile: async (path, content) => {
        writtenFiles.push({ path, content });
      },
    },
  );

  const result = await client.vaultExportToFolder('workspace-1');

  assert.deepEqual(writtenFiles, [
    { path: 'C:/Vault/Plan.md', content: '# Plan' },
    { path: 'C:/Vault/Next.md', content: '# Next' },
  ]);
  assert.deepEqual(result, { directory: 'C:/Vault', filesWritten: 2 });
});
