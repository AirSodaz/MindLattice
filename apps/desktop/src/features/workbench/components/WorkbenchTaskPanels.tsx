import type { FormEvent, ReactNode } from 'react';

import type {
  CommandExperimentContext,
  CommandMemory,
  CommandStrategyDecision,
  CommandStrategyExperiment,
  CommandSupportTemplate,
  CommandVaultFile,
  VaultExportProfile,
} from '../../../shared/api/commandClient';
import { Badge, Button, Field, Notice, Surface } from '../../../shared/ui';
import type { SupportTemplateRecommendation, WorkbenchTaskPanel, WorkbenchNode } from '../workbenchModel';

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
  memoryReviewPanel?: ReactNode;
  memoryDrafts: Record<string, string>;
  pendingMemoryDrafts: Record<string, string>;
  pendingMemoryProposals: CommandMemory[];
  pendingStrategyExperiments: CommandStrategyExperiment[];
  pendingVaultImport: { fileCount: number; totalBytes: number } | null;
  preferenceMemory: CommandMemory[];
  settingsPanel: ReactNode;
  supportDrafts: Record<string, { title: string; body: string }>;
  supportRecommendations: SupportTemplateRecommendation[];
  supportTemplates: CommandSupportTemplate[];
  vaultExportSummary: string;
  vaultImportContent: string;
  vaultImportFilename: string;
  workspaceReady: boolean;
  onAcceptAllMemoryProposals: (drafts: Record<string, string>) => void;
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
  onRejectAllMemoryProposals: () => void;
  onRejectMemoryProposal: (memoryId: string) => void;
  onRejectStrategyExperiment: (experimentId: string) => void;
  onRejectVaultImport: () => void;
  onSaveCustomSupportTemplate: () => void;
  onSaveMemory: (memoryId: string, text: string) => void;
  onSaveSupport: (supportId: string, title: string, body: string) => void;
  onSupportDraftChange: (supportId: string, draft: { title: string; body: string }) => void;
  onVaultExportPreview: (profile: VaultExportProfile) => void;
  onVaultExportToFolder: (profile: VaultExportProfile) => void;
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
      <Surface className="settings-surface" tone="settings" eyebrow="Diagnostics" title="Nothing to inspect">
        <p className="agent-setup-hint">No diagnostic surface is active.</p>
      </Surface>
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
    <Surface className="support-surface" tone="default" eyebrow="Support templates" title="Try one support">
      <div className="support-list">
        {props.supportTemplates.slice(0, 3).map((template) => (
          <article className="support-template ml-list-item" key={template.id}>
            <div>
              <span>{template.category.replaceAll('_', ' ')}</span>
              <h3>{template.title}</h3>
            </div>
            <p>{template.steps[0]}</p>
            {props.supportRecommendations.find((recommendation) => recommendation.template.id === template.id) ? (
              <p className="support-reason">
                <span>Recommended because</span>
                {props.supportRecommendations.find((recommendation) => recommendation.template.id === template.id)?.reason}
              </p>
            ) : null}
            <Button
              disabled={props.isSupportAdopting || !props.workspaceReady}
              onClick={() => props.onAdoptSupportTemplate(template.id)}
              type="button"
              variant="secondary"
            >
              Adopt
            </Button>
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
                  <Button disabled={props.isSupportSaving || !draft.title.trim()} type="submit" variant="primary">
                    Save
                  </Button>
                  <Button
                    disabled={props.isSupportSaving}
                    onClick={() => props.onDiscardSupport(support.id)}
                    type="button"
                    variant="secondary"
                  >
                    Discard
                  </Button>
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
          <Button
            disabled={props.isCustomSupportCreating || !props.workspaceReady || !props.customSupportTitle.trim()}
            type="submit"
            variant="primary"
          >
            Create support
          </Button>
          <Button
            disabled={props.isCustomSupportTemplateSaving || !props.workspaceReady || !props.customSupportTitle.trim()}
            onClick={props.onSaveCustomSupportTemplate}
            type="button"
            variant="secondary"
          >
            Save template
          </Button>
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
        <Button disabled={props.isExperimentSaving || !props.experimentSupportId} type="submit" variant="secondary">
          Review experiment
        </Button>
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
                  <Button
                    disabled={props.isExperimentSaving}
                    onClick={() => props.onAcceptStrategyExperiment(experiment.id)}
                    type="button"
                    variant="primary"
                  >
                    Accept experiment
                  </Button>
                  <Button
                    disabled={props.isExperimentSaving}
                    onClick={() => props.onRejectStrategyExperiment(experiment.id)}
                    type="button"
                    variant="secondary"
                  >
                    Reject
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </Surface>
  );
}

function MemoryPanel(props: WorkbenchTaskPanelsProps) {
  return (
    <Surface className="memory-surface" tone="memory" eyebrow="Preference memory" title="Confirmed preferences">
      <p>Only confirmed memory is listed here. Agent proposals require explicit review before saving.</p>
      {props.pendingMemoryProposals.length > 0 ? (
        <Notice className="memory-review-callout" tone="draft" title={<Badge tone="draft">Draft</Badge>}>
          {props.pendingMemoryProposals.length} proposed preference memory item is waiting for review.
        </Notice>
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
                  <Button disabled={props.isMemorySaving || !draft.trim()} type="submit" variant="primary">
                    Save
                  </Button>
                  <Button
                    disabled={props.isMemorySaving}
                    onClick={() => props.onDeleteMemory(memory.id)}
                    type="button"
                    variant="secondary"
                  >
                    Delete
                  </Button>
                </div>
              </form>
            );
          })}
        </div>
      )}
      {props.memoryReviewPanel}
    </Surface>
  );
}

function VaultPanel(props: WorkbenchTaskPanelsProps) {
  return (
    <Surface className="vault-surface" tone="default" eyebrow="Vault import/export" title="Manual Markdown snapshot">
      <div className="action-row">
        <Button disabled={props.isVaultBusy || !props.workspaceReady} onClick={() => props.onVaultExportPreview('obsidian_readable')} type="button" variant="secondary">
          Preview Obsidian export
        </Button>
        <Button disabled={props.isVaultBusy || !props.workspaceReady} onClick={() => props.onVaultExportToFolder('obsidian_readable')} type="button" variant="secondary">
          Export Obsidian folder
        </Button>
        <Button disabled={props.isVaultBusy || !props.workspaceReady} onClick={() => props.onVaultExportToFolder('plain_markdown')} type="button" variant="secondary">
          Export plain folder
        </Button>
        <Button disabled={props.isVaultBusy || !props.workspaceReady} onClick={props.onVaultPickImportFolder} type="button" variant="secondary">
          Import folder
        </Button>
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
        <Field label="Markdown filename">
          <input
            disabled={props.isVaultBusy}
            onChange={(event) => props.onVaultImportFilenameChange(event.target.value)}
            value={props.vaultImportFilename}
          />
        </Field>
        <Field label="Markdown content">
          <textarea
            disabled={props.isVaultBusy}
            onChange={(event) => props.onVaultImportContentChange(event.target.value)}
            placeholder="# Imported note"
            value={props.vaultImportContent}
          />
        </Field>
        <Button
          disabled={props.isVaultBusy || !props.vaultImportFilename.trim() || !props.vaultImportContent.trim()}
          type="submit"
          variant="secondary"
        >
          Preview import
        </Button>
      </form>
      {props.pendingVaultImport ? (
        <article className="vault-import-preview">
          <div>
            <span className="eyebrow">Pending import</span>
            <h3>{props.pendingVaultImport.fileCount} Markdown file</h3>
          </div>
          <p>{props.pendingVaultImport.totalBytes} characters queued for manual import.</p>
          <div className="action-row">
            <Button disabled={props.isVaultBusy} onClick={props.onAcceptVaultImport} type="button" variant="primary">
              Accept import
            </Button>
            <Button disabled={props.isVaultBusy} onClick={props.onRejectVaultImport} type="button" variant="secondary">
              Reject
            </Button>
          </div>
        </article>
      ) : null}
    </Surface>
  );
}
