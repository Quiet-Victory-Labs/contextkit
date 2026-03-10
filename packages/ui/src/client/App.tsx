import { currentStep } from './state';
import { Connect } from './steps/Connect';

function StepContent() {
  switch (currentStep.value) {
    case 1: return <Connect />;
    case 2: return <div>Define step (coming soon)</div>;
    case 3: return <div>Scaffold step (coming soon)</div>;
    case 4: return <div>Checkpoint step (coming soon)</div>;
    case 5: return <div>Enrich step (coming soon)</div>;
    case 6: return <div>Serve step (coming soon)</div>;
    default: return null;
  }
}

export function App() {
  return <StepContent />;
}
