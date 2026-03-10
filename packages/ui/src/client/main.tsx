import { render } from 'preact';
import { App } from './App';

const root = document.getElementById('wizard-content');
if (root) {
  render(<App />, root);
}
