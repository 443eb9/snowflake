import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider, Toaster, webDarkTheme } from '@fluentui/react-components'
import MainApp from './pages/app'
import Startup from './pages/startup'
import './global.css'
import { BrowserRouter } from 'react-router-dom'
import { Routes } from 'react-router-dom'
import { Route } from 'react-router-dom'
import QuickRef from './pages/quick-ref'
import ContextProvider from './helpers/context-provider'
import LanguageSwitch from './helpers/language-switch'

export const GlobalToasterId = "globalToasterId"

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <FluentProvider theme={webDarkTheme} className='test'>
            <ContextProvider>
                <div className="w-[100vw] h-[100vh] overflow-hidden" style={{ backgroundColor: "var(--colorNeutralBackground1)" }}>
                    <Toaster toasterId={GlobalToasterId} limit={3} />
                    <LanguageSwitch />
                    <Suspense>
                        <BrowserRouter>
                            <Routes>
                                <Route path="/app" element={<MainApp />} />
                                <Route path="/" element={<Startup />} />
                                <Route path="/quickref/:id" element={<QuickRef />} />
                            </Routes>
                        </BrowserRouter>
                    </Suspense>
                </div>
            </ContextProvider>
        </FluentProvider>
    </React.StrictMode>
)
