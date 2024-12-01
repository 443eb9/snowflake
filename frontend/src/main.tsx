import React from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider, webDarkTheme } from '@fluentui/react-components'
import MainApp from './app'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Startup from './pages/startup'
import './global.css'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <FluentProvider theme={webDarkTheme}>
            <HashRouter basename="/">
                <Routes>
                    <Route path="/app" element={<MainApp />} />
                    <Route path="/" element={<Startup />} />
                </Routes>
            </HashRouter>
        </FluentProvider>
    </React.StrictMode>
)
