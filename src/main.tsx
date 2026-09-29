import { render } from 'preact';
import { App } from './app/App';
import { startLlmSettings } from './app/llm';
import { startSettings } from './app/settings';
import './ui/tui/tui.css';

startSettings();
startLlmSettings();
render(<App />, document.getElementById('app')!);
