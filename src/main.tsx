import React from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider, webDarkTheme } from '@fluentui/react-components'
import MainApp from './app'
import Startup from './pages/startup'
import './global.css'
import { HashRouter } from 'react-router-dom'
import { Routes } from 'react-router-dom'
import { Route } from 'react-router-dom'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <FluentProvider theme={webDarkTheme} className='test'>
            <div className="w-[100vw] h-[100vh] overflow-hidden">
                <HashRouter basename="/">
                    <Routes>
                        <Route path="/app" element={<MainApp />} />
                        <Route path="/" element={<Startup />} />
                    </Routes>
                </HashRouter>
            </div>
        </FluentProvider>
    </React.StrictMode>
)
