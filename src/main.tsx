import { render } from 'preact'
import 'uplot/dist/uPlot.min.css'
import './index.css'
import { applyInitialTheme } from './state/persistence.ts'
import { App } from './app.tsx'

applyInitialTheme()
render(<App />, document.getElementById('app')!)
