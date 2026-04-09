import { createBrowserRouter, redirect } from 'react-router';
import Root from './Root';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import About from './pages/About';
import Contact from './pages/Contact';
import ContactSales from './pages/ContactSales';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import OpportunityDetail from './pages/OpportunityDetail';
import Artists from './pages/Artists';
import ArtistDetail from './pages/ArtistDetail';
import Market from './pages/Market';
import Alerts from './pages/Alerts';
import Portfolio from './pages/Portfolio';
import Agent from './pages/Agent';
import FAQ from './pages/FAQ';
import BillingSuccess from './pages/BillingSuccess';
import Primary from './pages/Primary';
import Convictions from './pages/Convictions';
import { ProtectedRoute } from './components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Landing,
  },
  {
    path: '/pricing',
    Component: Pricing,
  },
  {
    path: '/about',
    Component: About,
  },
  {
    path: '/contact',
    Component: Contact,
  },
  {
    path: '/faq',
    Component: FAQ,
  },
  {
    path: '/billing/success',
    Component: BillingSuccess,
  },
  {
    path: '/billing/cancel',
    Component: Pricing,
  },
  {
    path: '/app',
    Component: Root,
    children: [
      { index: true, loader: () => redirect('/app/dashboard') },
      { path: 'dashboard', Component: Dashboard },
      { path: 'explore', loader: () => redirect('/app/opportunities') },
      { path: 'login', Component: Login },
      { path: 'signup', Component: Signup },
      { path: 'contact', Component: ContactSales },
      { path: 'pricing', Component: Pricing },
      { path: 'opportunities', Component: Opportunities },
      { path: 'primary', Component: Primary },
      { path: 'convictions', Component: Convictions },
      { path: 'opportunities/:id', Component: OpportunityDetail },
      { path: 'artists', Component: Artists },
      { path: 'artists/:id', Component: ArtistDetail },
      { path: 'market', Component: Market },
      { path: 'alerts', Component: Alerts },
      { path: 'portfolio', Component: Portfolio },
      { path: 'agent', Component: Agent },
      { path: 'onboarding', Component: Onboarding },
    ],
  },
  {
    path: '/opportunities',
    Component: ProtectedRoute,
    children: [
      {
        Component: Root,
        children: [
          { index: true, Component: Opportunities },
          { path: ':id', Component: OpportunityDetail },
        ],
      },
    ],
  },
  {
    path: '/artists',
    Component: ProtectedRoute,
    children: [
      {
        Component: Root,
        children: [
          { index: true, Component: Artists },
          { path: ':id', Component: ArtistDetail },
        ],
      },
    ],
  },
  {
    path: '/market',
    Component: ProtectedRoute,
    children: [
      {
        Component: Root,
        children: [
          { index: true, Component: Market },
        ],
      },
    ],
  },
  {
    path: '/alerts',
    Component: ProtectedRoute,
    children: [
      {
        Component: Root,
        children: [
          { index: true, Component: Alerts },
        ],
      },
    ],
  },
  {
    path: '/portfolio',
    Component: ProtectedRoute,
    children: [
      {
        Component: Root,
        children: [
          { index: true, Component: Portfolio },
        ],
      },
    ],
  },
]);
