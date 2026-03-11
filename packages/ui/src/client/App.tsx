import { currentStep } from './state';
import { Connect } from './steps/Connect';
import { Define } from './steps/Define';
import { Scaffold } from './steps/Scaffold';

function StepContent() {
  switch (currentStep.value) {
    case 1: return <Connect />;
    case 2: return <Define />;
    case 3: return <Scaffold />;
    case 4: return <div>Checkpoint step (coming soon)</div>;
    case 5: return <div>Enrich step (coming soon)</div>;
    case 6: return <div>Serve step (coming soon)</div>;
    default: return null;
  }
}

export function App() {
  return <StepContent />;
}
