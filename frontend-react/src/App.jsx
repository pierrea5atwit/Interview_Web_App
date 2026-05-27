import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Home from './pages/Home.jsx'
import Practice from './pages/Practice.jsx'
import BestResponses from './pages/BestResponses.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"               element={<Home />} />
          <Route path="/practice"       element={<Practice />} />
          <Route path="/best-responses" element={<BestResponses />} />
          <Route path="/settings"       element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
