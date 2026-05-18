import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PreviewReviewPanel } from './PreviewReviewPanel';
import { StartPanel } from './StartPanel';
import { WorkbenchTaskPanels } from './WorkbenchTaskPanels';
import { changeLanguagePreference } from '../../../shared/i18n/i18n';
import { buildInitialWorkbench, buildPreviewDiff, buildReturnContext, recommendSupportTemplates } from '../workbenchModel';

test('preview review renders concrete diff rows before acceptance', async () => {
  await changeLanguagePreference('en');
  const model = buildInitialWorkbench();
  const html = renderToStaticMarkup(
    React.createElement(PreviewReviewPanel, {
      activePreview: model.activePreview,
      previewDiff: buildPreviewDiff(model.activePreview),
      isBusy: false,
      onAccept: () => {},
      onRevise: () => {},
      onReject: () => {},
    }),
  );

  assert.match(html, /I drafted a structure. Nothing is saved yet./);
  assert.match(html, /This will save 1 node and 1 link./);
  assert.match(html, /Add next action/);
  assert.match(html, /Find one example to paste below the outline/);
  assert.match(html, /Draft/);
  assert.match(html, /Revise/);
  assert.match(html, /No update or delete operations are included/);
  assert.match(html, /class="[^"]*ml-surface[^"]*preview-surface/);
  assert.match(html, /class="[^"]*ml-list-item[^"]*ml-list-item-draft/);
  assert.match(html, /class="[^"]*ml-badge[^"]*ml-badge-draft/);
  assert.match(html, /class="[^"]*ml-button[^"]*ml-button-primary/);
  assert.match(html, /class="[^"]*ml-button[^"]*ml-button-secondary/);
});

test('start panel renders return context and smaller-action request', async () => {
  await changeLanguagePreference('en');
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
        checks: [{ label: 'Five-minute fit', value: 'Fits a five-minute start.', checked: true }],
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
  assert.match(html, /Make this smaller./);
  assert.match(html, /Start with five minutes./);
  assert.match(html, /Leave a return cue for later./);
  assert.match(html, /Five-minute fit/);
  assert.match(html, /class="[^"]*ml-surface[^"]*start-mode-surface/);
  assert.match(html, /class="[^"]*ml-button[^"]*ml-button-primary/);
  assert.match(html, /class="[^"]*ml-list-item[^"]*start-check-row/);
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
    memoryReviewPanel: React.createElement('section', {}, 'Agent proposed memory Accept all reviewed'),
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
  assert.match(memoryHtml, /Confirmed preferences/);
  assert.match(memoryHtml, /Only confirmed memory is listed here/);
  assert.match(memoryHtml, /Agent proposed memory/);
  assert.match(memoryHtml, /Accept all reviewed/);
  assert.match(memoryHtml, /class="[^"]*ml-surface[^"]*memory-surface/);
  assert.match(memoryHtml, /class="[^"]*ml-notice[^"]*ml-notice-draft/);
  assert.match(vaultHtml, /Preview Obsidian export/);
  assert.match(vaultHtml, /Export plain folder/);
});
