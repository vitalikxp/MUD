import { render } from 'preact';
import { App } from './app/App';
import { requestPersistence } from './app/campaigns';
import { startLlmSettings } from './app/llm';
import { startSettings } from './app/settings';
import './ui/tui/tui.css';

startSettings();
startLlmSettings();
void requestPersistence();
render(<App />, document.getElementById('app')!);
