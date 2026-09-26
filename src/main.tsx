import { render } from 'preact'
import 'uplot/dist/uPlot.min.css'
import './index.css'
import { App } from './app.tsx'

render(<App />, document.getElementById('app')!)
