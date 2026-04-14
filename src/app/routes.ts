import { lazy } from 'react';
import { createBrowserRouter, redirect } from 'react-router';
import Root from './Root';
import { ProtectedRoute } from './components/ProtectedRoute';

const Landing       = lazy(() => import('./pages/Landing'));
const Pricing       = lazy(() => import('./pages/Pricing'));
const About         = lazy(() => import('./pages/About'));
const Contact       = lazy(() => import('./pages/Contact'));
const ContactSales  = lazy(() => import('./pages/ContactSales'));
const Login         = lazy(() => import('./pages/Login'));
const Signup        = lazy(() => import('./pages/Signup'));
const Onboarding    = lazy(() => import('./pages/Onboarding'));
const Home          = lazy(() => import('./pages/Home'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Explore       = lazy(() => import('./pages/Explore'));
const Opportunities = lazy(() => import('./pages/Opportunities'));
const OpportunityDetail = lazy(() => import('./pages/OpportunityDetail'));
const Artists       = lazy(() => import('./pages/Artists'));
const ArtistDetail  = lazy(() => import('./pages/ArtistDetail'));
const Market        = lazy(() => import('./pages/Market'));
const Alerts        = lazy(() => import('./pages/Alerts'));
const Portfolio     = lazy(() => import('./pages/Portfolio'));
const Agent         = lazy(() => import('./pages/Agent'));
const FAQ           = lazy(() => import('./pages/FAQ'));
const BillingSuccess = lazy(() => import('./pages/BillingSuccess'));
const Primary       = lazy(() => import('./pages/Primary'));
const Convictions   = lazy(() => import('./pages/Convictions'));
const MarketIndex   = lazy(() => import('./pages/MarketIndex'));

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
    path: '/market-index',
    Component: MarketIndex,
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
      { path: 'explore', Component: Explore },
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
