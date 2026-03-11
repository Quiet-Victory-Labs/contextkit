import { Fragment } from 'preact';
import { currentStep, STEP_LABELS } from '../state';

export function Stepper() {
  const step = currentStep.value;

  return (
    <>
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const cls = stepNum < step ? 'step-completed' : stepNum === step ? 'step-active' : 'step-future';
        return (
          <Fragment key={label}>
            <span
              class={cls}
              onClick={stepNum < step ? () => { currentStep.value = stepNum; } : undefined}
              style={stepNum < step ? { cursor: 'pointer' } : undefined}
            >
              {label}
            </span>
            {stepNum < STEP_LABELS.length && <span class="step-separator">{'>'}</span>}
          </Fragment>
        );
      })}
    </>
  );
}
