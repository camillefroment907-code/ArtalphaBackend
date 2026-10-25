// Isolated preview: deliberately excludes legacy auth, analytics and backend warm-up.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import Notebook from './app/pages/NautilusNotebook';
import Home from './app/pages/NautilusV2Home';
import Taste from './app/pages/ArtisticTasteV2';
import Calculator from './app/pages/AuctionCostCalculatorV2';
createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes><Route path="/v2" element={<Home/>}/><Route path="/decouvrir/mon-profil-artistique" element={<Taste/>}/><Route path="/outils/calculateur-encheres" element={<Calculator/>}/><Route path="*" element={<Notebook/>}/></Routes></BrowserRouter>);
