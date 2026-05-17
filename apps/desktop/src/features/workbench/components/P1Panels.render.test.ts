import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PreviewReviewPanel } from './PreviewReviewPanel';
import { StartPanel } from './StartPanel';
import { WorkbenchTaskPanels } from './WorkbenchTaskPanels';
import { buildInitialWorkbench, buildPreviewDiff, buildReturnContext, recommendSupportTemplates } from '../workbenchModel';

test('preview review renders concrete diff rows before acceptance', () => {
  const model = buildInitialWorkbench();
  const html = renderToStaticMarkup(
    React.createElement(PreviewReviewPanel, {
      activePreview: model.activePreview,
      previewDiff: buildPreviewDiff(model.activePreview),
      isBusy: false,
      onAccept: () => {},
      onReject: () => {},
    }),
  );

  assert.match(html, /Add next action/);
  assert.match(html, /Find one example to paste below the outline/);
  assert.match(html, /No update or delete operations are included/);
});

test('start panel renders return context and smaller-action request', () => {
  const model = buildInitialWorkbench();
  const html = renderToStaticMarkup(
    React.createElement(StartPanel, {
      attentionSession: null,
      checkInDraft: '',
      checkIns: [],
      followUpPrompts: [],
      hasStartableAction: true,
      isCheckInSaving: false,
      isSessionBusy: false,
      returnContext: buildReturnContext(model, []),
      sessionCompletionNote: '',
      startModeView: {
        nextAction: 'Open the draft and write three bullets',
        minimumDone: 'Three bullets exist.',
        checks: ['Five-minute fit'],
        details: [],
      },
      startTimerState: null,
      workspaceReady: true,
      onCheckInDraftChange: () => {},
      onCloseSession: () => {},
      onRequestSmallerAction: () => {},
      onSaveCheckIn: () => {},
      onSessionCompletionNoteChange: () => {},
      onStartSession: () => {},
    }),
  );

  assert.match(html, /Return context/);
  assert.match(html, /Open the draft and write three bullets/);
  assert.match(html, /Make smaller/);
});

test('task panels render support reasons, memory batch review, and export profiles', () => {
  const model = buildInitialWorkbench();
  const recommendations = recommendSupportTemplates(model, [
    {
      id: 'visible-checklist',
      category: 'task_structure',
      title: 'Visible short checklist',
      steps: ['Write no more than three visible steps.'],
      defaultContexts: ['work'],
      sourceNote: 'General task-structure support pattern.',
      safetyNote: 'Self-help execution support, not treatment advice.',
    },
  ]);
  const props = {
    activePanel: 'support',
    adoptedSupports: [],
    customSupportBody: '',
    customSupportTitle: '',
    experimentContext: 'work',
    experimentDecision: 'keep',
    experimentHelped: { start: true, continue: false, return: false, clarify: false },
    experimentObstacle: '',
    experimentSupportId: 'visible-checklist',
    isCustomSupportCreating: false,
    isCustomSupportTemplateSaving: false,
    isExperimentSaving: false,
    isMemorySaving: false,
    isSupportAdopting: false,
    isSupportSaving: false,
    isVaultBusy: false,
    memoryDrafts: {},
    pendingMemoryDrafts: { 'memory-1': 'Prefer visible return cues.' },
    pendingMemoryProposals: [
      {
        id: 'memory-1',
        proposedMemoryText: 'Prefer visible return cues.',
        evidenceReference: 'check-in-1',
      },
    ],
    pendingStrategyExperiments: [],
    pendingVaultImport: null,
    preferenceMemory: [],
    settingsPanel: null,
    supportDrafts: {},
    supportRecommendations: recommendations,
    supportTemplates: recommendations.map((item) => item.template),
    vaultExportSummary: '',
    vaultImportContent: '',
    vaultImportFilename: 'Imported.md',
    workspaceReady: true,
    onAcceptAllMemoryProposals: () => {},
    onAcceptMemoryProposal: () => {},
    onAcceptStrategyExperiment: () => {},
    onAcceptVaultImport: () => {},
    onAdoptSupportTemplate: () => {},
    onCreateCustomSupport: () => {},
    onDeleteMemory: () => {},
    onDiscardSupport: () => {},
    onExperimentContextChange: () => {},
    onExperimentDecisionChange: () => {},
    onExperimentHelpedChange: () => {},
    onExperimentObstacleChange: () => {},
    onExperimentSupportIdChange: () => {},
    onMemoryDraftChange: () => {},
    onPendingMemoryDraftChange: () => {},
    onPreviewStrategyExperiment: () => {},
    onPreviewVaultImport: () => {},
    onRejectAllMemoryProposals: () => {},
    onRejectMemoryProposal: () => {},
    onRejectStrategyExperiment: () => {},
    onRejectVaultImport: () => {},
    onSaveCustomSupportTemplate: () => {},
    onSaveMemory: () => {},
    onSaveSupport: () => {},
    onSupportDraftChange: () => {},
    onVaultExportPreview: () => {},
    onVaultExportToFolder: () => {},
    onVaultImportContentChange: () => {},
    onVaultImportFilenameChange: () => {},
    onVaultPickImportFolder: () => {},
    onCustomSupportBodyChange: () => {},
    onCustomSupportTitleChange: () => {},
  };

  const supportHtml = renderToStaticMarkup(React.createElement(WorkbenchTaskPanels, props));
  const memoryHtml = renderToStaticMarkup(React.createElement(WorkbenchTaskPanels, { ...props, activePanel: 'memory' }));
  const vaultHtml = renderToStaticMarkup(React.createElement(WorkbenchTaskPanels, { ...props, activePanel: 'vault' }));

  assert.match(supportHtml, /Recommended because/);
  assert.match(supportHtml, /keeps the first action small and visible/);
  assert.match(memoryHtml, /Accept all reviewed/);
  assert.match(memoryHtml, /Reject all/);
  assert.match(vaultHtml, /Preview Obsidian export/);
  assert.match(vaultHtml, /Export plain folder/);
});
