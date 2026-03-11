import { Fragment } from 'preact';
import { Tooltip } from '@runcontext/uxd/react';
import { currentStep, STEP_LABELS } from '../state';

const STEP_DESCRIPTIONS: Record<string, string> = {
  Connect: 'Connect to your database or data source',
  Define: 'Define your semantic plane metadata',
  Scaffold: 'Build the Bronze-tier context layer',
  Checkpoint: 'Review your progress and choose next steps',
  Curate: 'Have your AI agent curate to Gold tier',
  Serve: 'Start your MCP endpoint for AI agents',
};

export function Stepper() {
  const step = currentStep.value;

  return (
    <>
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const cls = stepNum < step ? 'step-completed' : stepNum === step ? 'step-active' : 'step-future';
        return (
          <Fragment key={label}>
            <Tooltip content={STEP_DESCRIPTIONS[label]} placement="bottom">
              <span
                class={cls}
                onClick={stepNum < step ? () => { currentStep.value = stepNum; } : undefined}
                style={stepNum < step ? { cursor: 'pointer' } : undefined}
              >
                {label}
              </span>
            </Tooltip>
            {stepNum < STEP_LABELS.length && <span class="step-separator">{'>'}</span>}
          </Fragment>
        );
      })}
    </>
  );
}
