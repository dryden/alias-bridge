import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './settings.css'
import SettingsPage from './SettingsPage.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <SettingsPage />
    </StrictMode>,
)
