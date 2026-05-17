import type { FormEvent, ReactNode } from 'react';

import type {
  CommandExperimentContext,
  CommandMemory,
  CommandStrategyDecision,
  CommandStrategyExperiment,
  CommandSupportTemplate,
  CommandVaultFile,
} from '../../../shared/api/commandClient';
import type { WorkbenchTaskPanel, WorkbenchNode } from '../workbenchModel';

export type WorkbenchTaskPanelsProps = {
  activePanel: WorkbenchTaskPanel;
  adoptedSupports: WorkbenchNode[];
  customSupportBody: string;
  customSupportTitle: string;
  experimentContext: CommandExperimentContext;
  experimentDecision: CommandStrategyDecision;
  experimentHelped: {
    start: boolean;
    continue: boolean;
    return: boolean;
    clarify: boolean;
  };
  experimentObstacle: string;
  experimentSupportId: string;
  isCustomSupportCreating: boolean;
  isCustomSupportTemplateSaving: boolean;
  isExperimentSaving: boolean;
  isMemorySaving: boolean;
  isSupportAdopting: boolean;
  isSupportSaving: boolean;
  isVaultBusy: boolean;
  memoryDrafts: Record<string, string>;
  pendingMemoryDrafts: Record<string, string>;
  pendingMemoryProposals: CommandMemory[];
  pendingStrategyExperiments: CommandStrategyExperiment[];
  pendingVaultImport: { fileCount: number; totalBytes: number } | null;
  preferenceMemory: CommandMemory[];
  settingsPanel: ReactNode;
  supportDrafts: Record<string, { title: string; body: string }>;
  supportTemplates: CommandSupportTemplate[];
  vaultExportSummary: string;
  vaultImportContent: string;
  vaultImportFilename: string;
  workspaceReady: boolean;
  onAcceptMemoryProposal: (memoryId: string, text: string) => void;
  onAcceptStrategyExperiment: (experimentId: string) => void;
  onAcceptVaultImport: () => void;
  onAdoptSupportTemplate: (templateId: string) => void;
  onCreateCustomSupport: () => void;
  onDeleteMemory: (memoryId: string) => void;
  onDiscardSupport: (supportId: string) => void;
  onExperimentContextChange: (value: CommandExperimentContext) => void;
  onExperimentDecisionChange: (value: CommandStrategyDecision) => void;
  onExperimentHelpedChange: (key: keyof WorkbenchTaskPanelsProps['experimentHelped'], value: boolean) => void;
  onExperimentObstacleChange: (value: string) => void;
  onExperimentSupportIdChange: (value: string) => void;
  onMemoryDraftChange: (memoryId: string, value: string) => void;
  onPendingMemoryDraftChange: (memoryId: string, value: string) => void;
  onPreviewVaultImport: (files: CommandVaultFile[]) => void;
  onPreviewStrategyExperiment: () => void;
  onRejectMemoryProposal: (memoryId: string) => void;
  onRejectStrategyExperiment: (experimentId: string) => void;
  onRejectVaultImport: () => void;
  onSaveCustomSupportTemplate: () => void;
  onSaveMemory: (memoryId: string, text: string) => void;
  onSaveSupport: (supportId: string, title: string, body: string) => void;
  onSupportDraftChange: (supportId: string, draft: { title: string; body: string }) => void;
  onVaultExportPreview: () => void;
  onVaultExportToFolder: () => void;
  onVaultImportContentChange: (value: string) => void;
  onVaultImportFilenameChange: (value: string) => void;
  onVaultPickImportFolder: () => void;
  onCustomSupportBodyChange: (value: string) => void;
  onCustomSupportTitleChange: (value: string) => void;
};

export function WorkbenchTaskPanels(props: WorkbenchTaskPanelsProps) {
  if (props.activePanel === 'settings') {
    return <>{props.settingsPanel}</>;
  }
  if (props.activePanel === 'support') {
    return <SupportPanel {...props} />;
  }
  if (props.activePanel === 'memory') {
    return <MemoryPanel {...props} />;
  }
  if (props.activePanel === 'vault') {
    return <VaultPanel {...props} />;
  }
  if (props.activePanel === 'diagnostics') {
    return (
      <section className="settings-surface">
        <span className="eyebrow">Diagnostics</span>
        <h2>Nothing to inspect</h2>
      </section>
    );
  }
  return null;
}

function SupportPanel(props: WorkbenchTaskPanelsProps) {
  const handleCustomSupportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (props.isCustomSupportCreating || !props.customSupportTitle.trim()) {
      return;
    }
    props.onCreateCustomSupport();
  };
  const handleExperimentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (props.isExperimentSaving || !props.experimentSupportId) {
      return;
    }
    props.onPreviewStrategyExperiment?.();
  };

  return (
    <section className="support-surface">
      <div>
        <span className="eyebrow">Support templates</span>
        <h2>Try one support</h2>
      </div>
      <div className="support-list">
        {props.supportTemplates.slice(0, 3).map((template) => (
          <article className="support-template" key={template.id}>
            <div>
              <span>{template.category.replaceAll('_', ' ')}</span>
              <h3>{template.title}</h3>
            </div>
            <p>{template.steps[0]}</p>
            <button
              disabled={props.isSupportAdopting || !props.workspaceReady}
              onClick={() => props.onAdoptSupportTemplate(template.id)}
              type="button"
            >
              Adopt
            </button>
          </article>
        ))}
      </div>
      <div className="adopted-supports">
        <div>
          <span className="eyebrow">Adopted supports</span>
          <h3>Keep or adjust</h3>
        </div>
        {props.adoptedSupports.length === 0 ? (
          <p>No adopted support yet.</p>
        ) : (
          props.adoptedSupports.map((support) => {
            const draft = props.supportDrafts[support.id] ?? { title: support.title, body: support.body ?? '' };
            return (
              <form
                className="support-editor"
                key={support.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.title.trim()) {
                    return;
                  }
                  props.onSaveSupport(support.id, draft.title, draft.body);
                }}
              >
                <label>
                  Title
                  <input
                    disabled={props.isSupportSaving}
                    onChange={(event) => props.onSupportDraftChange(support.id, { ...draft, title: event.target.value })}
                    value={draft.title}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    disabled={props.isSupportSaving}
                    onChange={(event) => props.onSupportDraftChange(support.id, { ...draft, body: event.target.value })}
                    value={draft.body}
                  />
                </label>
                <div className="action-row">
                  <button disabled={props.isSupportSaving || !draft.title.trim()} type="submit">
                    Save
                  </button>
                  <button
                    className="secondary"
                    disabled={props.isSupportSaving}
                    onClick={() => props.onDiscardSupport(support.id)}
                    type="button"
                  >
                    Discard
                  </button>
                </div>
              </form>
            );
          })
        )}
      </div>
      <form className="custom-support-form" onSubmit={handleCustomSupportSubmit}>
        <div>
          <span className="eyebrow">Custom support</span>
          <h3>Create one support</h3>
        </div>
        <label>
          Title
          <input
            disabled={props.isCustomSupportCreating || !props.workspaceReady}
            onChange={(event) => props.onCustomSupportTitleChange(event.target.value)}
            placeholder="Name the support"
            value={props.customSupportTitle}
          />
        </label>
        <label>
          Notes
          <textarea
            disabled={props.isCustomSupportCreating || !props.workspaceReady}
            onChange={(event) => props.onCustomSupportBodyChange(event.target.value)}
            placeholder="What should stay visible when you try it?"
            value={props.customSupportBody}
          />
        </label>
        <div className="action-row">
          <button disabled={props.isCustomSupportCreating || !props.workspaceReady || !props.customSupportTitle.trim()} type="submit">
            Create support
          </button>
          <button
            className="secondary"
            disabled={props.isCustomSupportTemplateSaving || !props.workspaceReady || !props.customSupportTitle.trim()}
            onClick={props.onSaveCustomSupportTemplate}
            type="button"
          >
            Save template
          </button>
        </div>
      </form>
      <form className="strategy-experiment-form" onSubmit={handleExperimentSubmit}>
        <div>
          <span className="eyebrow">Strategy experiment</span>
          <h3>Record what helped</h3>
        </div>
        <label>
          Support tried
          <select
            disabled={props.isExperimentSaving || props.supportTemplates.length === 0}
            onChange={(event) => props.onExperimentSupportIdChange(event.target.value)}
            value={props.experimentSupportId}
          >
            {props.supportTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Context
          <select
            disabled={props.isExperimentSaving}
            onChange={(event) => props.onExperimentContextChange(event.target.value as CommandExperimentContext)}
            value={props.experimentContext}
          >
            <option value="work">Work</option>
            <option value="study">Study</option>
            <option value="home_responsibility">Home responsibility</option>
            <option value="personal_project">Personal project</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <fieldset>
          <legend>Helped with</legend>
          {[
            ['start', 'Starting'],
            ['continue', 'Continuing'],
            ['return', 'Returning'],
            ['clarify', 'Clarifying next action'],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                checked={props.experimentHelped[key as keyof typeof props.experimentHelped]}
                disabled={props.isExperimentSaving}
                onChange={(event) =>
                  props.onExperimentHelpedChange(key as keyof typeof props.experimentHelped, event.target.checked)
                }
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label>
          What got in the way
          <textarea
            disabled={props.isExperimentSaving}
            onChange={(event) => props.onExperimentObstacleChange(event.target.value)}
            placeholder="Optional obstacle or adjustment note"
            value={props.experimentObstacle}
          />
        </label>
        <label>
          Next decision
          <select
            disabled={props.isExperimentSaving}
            onChange={(event) => props.onExperimentDecisionChange(event.target.value as CommandStrategyDecision)}
            value={props.experimentDecision}
          >
            <option value="keep">Keep</option>
            <option value="revise">Revise</option>
            <option value="pause">Pause</option>
            <option value="remove">Remove</option>
          </select>
        </label>
        <button disabled={props.isExperimentSaving || !props.experimentSupportId} type="submit">
          Review experiment
        </button>
      </form>
      {props.pendingStrategyExperiments.length > 0 ? (
        <div className="strategy-proposal-list" aria-label="Pending strategy experiment proposals">
          {props.pendingStrategyExperiments.map((experiment) => {
            const supportLabel = experiment.supportTemplateId ?? experiment.customSupportTitle ?? 'custom support';
            return (
              <article className="strategy-proposal" key={experiment.id}>
                <div>
                  <span className="eyebrow">Pending experiment</span>
                  <h3>
                    {experiment.nextDecision} {supportLabel}
                  </h3>
                </div>
                {experiment.obstacleNote ? <p>{experiment.obstacleNote}</p> : null}
                <div className="action-row">
                  <button disabled={props.isExperimentSaving} onClick={() => props.onAcceptStrategyExperiment(experiment.id)} type="button">
                    Accept experiment
                  </button>
                  <button
                    className="secondary"
                    disabled={props.isExperimentSaving}
                    onClick={() => props.onRejectStrategyExperiment(experiment.id)}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function MemoryPanel(props: WorkbenchTaskPanelsProps) {
  return (
    <section className="memory-surface">
      <div>
        <span className="eyebrow">Preference memory</span>
        <h2>Review saved preferences</h2>
      </div>
      {props.pendingMemoryProposals.length > 0 ? (
        <div className="memory-list" aria-label="Pending preference memory proposals">
          {props.pendingMemoryProposals.map((memory) => {
            const draft = props.pendingMemoryDrafts[memory.id] ?? memory.proposedMemoryText;
            return (
              <form
                className="memory-item pending"
                key={memory.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.trim()) {
                    return;
                  }
                  props.onAcceptMemoryProposal(memory.id, draft);
                }}
              >
                <label>
                  Proposed preference
                  <textarea
                    disabled={props.isMemorySaving}
                    onChange={(event) => props.onPendingMemoryDraftChange(memory.id, event.target.value)}
                    value={draft}
                  />
                </label>
                {memory.evidenceReference ? <span>Evidence: {memory.evidenceReference}</span> : null}
                <div className="action-row">
                  <button disabled={props.isMemorySaving || !draft.trim()} type="submit">
                    Accept memory
                  </button>
                  <button
                    className="secondary"
                    disabled={props.isMemorySaving}
                    onClick={() => props.onRejectMemoryProposal(memory.id)}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      ) : null}
      {props.preferenceMemory.length === 0 ? (
        <p>No saved preference memory yet.</p>
      ) : (
        <div className="memory-list">
          {props.preferenceMemory.map((memory) => {
            const draft = props.memoryDrafts[memory.id] ?? memory.proposedMemoryText;
            return (
              <form
                className="memory-item"
                key={memory.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.trim()) {
                    return;
                  }
                  props.onSaveMemory(memory.id, draft);
                }}
              >
                <label>
                  Saved preference
                  <textarea
                    disabled={props.isMemorySaving}
                    onChange={(event) => props.onMemoryDraftChange(memory.id, event.target.value)}
                    value={draft}
                  />
                </label>
                {memory.evidenceReference ? <span>Evidence: {memory.evidenceReference}</span> : null}
                <div className="action-row">
                  <button disabled={props.isMemorySaving || !draft.trim()} type="submit">
                    Save
                  </button>
                  <button
                    className="secondary"
                    disabled={props.isMemorySaving}
                    onClick={() => props.onDeleteMemory(memory.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VaultPanel(props: WorkbenchTaskPanelsProps) {
  return (
    <section className="vault-surface">
      <div>
        <span className="eyebrow">Vault import/export</span>
        <h2>Manual Markdown snapshot</h2>
      </div>
      <div className="action-row">
        <button disabled={props.isVaultBusy || !props.workspaceReady} onClick={props.onVaultExportPreview} type="button">
          Preview export
        </button>
        <button disabled={props.isVaultBusy || !props.workspaceReady} onClick={props.onVaultExportToFolder} type="button">
          Export folder
        </button>
        <button className="secondary" disabled={props.isVaultBusy || !props.workspaceReady} onClick={props.onVaultPickImportFolder} type="button">
          Import folder
        </button>
      </div>
      {props.vaultExportSummary ? <p>{props.vaultExportSummary}</p> : null}
      <form
        className="vault-import-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (props.isVaultBusy || !props.vaultImportFilename.trim() || !props.vaultImportContent.trim()) {
            return;
          }
          props.onPreviewVaultImport([
            {
              filename: props.vaultImportFilename.trim(),
              content: props.vaultImportContent,
            },
          ]);
        }}
      >
        <label>
          Markdown filename
          <input
            disabled={props.isVaultBusy}
            onChange={(event) => props.onVaultImportFilenameChange(event.target.value)}
            value={props.vaultImportFilename}
          />
        </label>
        <label>
          Markdown content
          <textarea
            disabled={props.isVaultBusy}
            onChange={(event) => props.onVaultImportContentChange(event.target.value)}
            placeholder="# Imported note"
            value={props.vaultImportContent}
          />
        </label>
        <button disabled={props.isVaultBusy || !props.vaultImportFilename.trim() || !props.vaultImportContent.trim()} type="submit">
          Preview import
        </button>
      </form>
      {props.pendingVaultImport ? (
        <article className="vault-import-preview">
          <div>
            <span className="eyebrow">Pending import</span>
            <h3>{props.pendingVaultImport.fileCount} Markdown file</h3>
          </div>
          <p>{props.pendingVaultImport.totalBytes} characters queued for manual import.</p>
          <div className="action-row">
            <button disabled={props.isVaultBusy} onClick={props.onAcceptVaultImport} type="button">
              Accept import
            </button>
            <button className="secondary" disabled={props.isVaultBusy} onClick={props.onRejectVaultImport} type="button">
              Reject
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
