import { render } from 'preact';
import { App } from './app/App';
import { startSettings } from './app/settings';
import './ui/tui/tui.css';

startSettings();
render(<App />, document.getElementById('app')!);
