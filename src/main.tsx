import React from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider, webDarkTheme } from '@fluentui/react-components'
import MainApp from './app'
import Startup from './pages/startup'
import './global.css'
import { BrowserRouter } from 'react-router-dom'
import { Routes } from 'react-router-dom'
import { Route } from 'react-router-dom'
import QuickRef from './pages/quick-ref'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <FluentProvider theme={webDarkTheme} className='test'>
            <div className="w-[100vw] h-[100vh] overflow-hidden">
                <BrowserRouter>
                    <Routes>
                        <Route path="/app" element={<MainApp />} />
                        <Route path="/" element={<Startup />} />
                        <Route path="/quickref/:id" element={<QuickRef />} />
                    </Routes>
                </BrowserRouter>
            </div>
        </FluentProvider>
    </React.StrictMode>
)
