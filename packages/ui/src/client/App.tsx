import { currentStep } from './state';
import { Checkpoint } from './steps/Checkpoint';
import { Connect } from './steps/Connect';
import { Define } from './steps/Define';
import { Enrich } from './steps/Enrich';
import { Scaffold } from './steps/Scaffold';
import { Serve } from './steps/Serve';

function StepContent() {
  switch (currentStep.value) {
    case 1: return <Connect />;
    case 2: return <Define />;
    case 3: return <Scaffold />;
    case 4: return <Checkpoint />;
    case 5: return <Enrich />;
    case 6: return <Serve />;
    default: return null;
  }
}

export function App() {
  return <StepContent />;
}
