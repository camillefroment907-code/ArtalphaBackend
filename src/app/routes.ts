import { lazy } from 'react';
import { createBrowserRouter, redirect } from 'react-router';
import Root from './Root';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';

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
const SignalFeed    = lazy(() => import('./pages/SignalFeed'));
const Explore       = lazy(() => import('./pages/Explore'));
const Opportunities = lazy(() => import('./pages/Opportunities'));
const OpportunityDetail = lazy(() => import('./pages/OpportunityDetail'));
const Artists       = lazy(() => import('./pages/Artists'));
const ArtistDetail  = lazy(() => import('./pages/ArtistDetail'));
const ArtistIntelligence = lazy(() => import('./pages/ArtistIntelligence'));
const Market        = lazy(() => import('./pages/Market'));
const Alerts        = lazy(() => import('./pages/Alerts'));
const Portfolio     = lazy(() => import('./pages/Portfolio'));
const Agent         = lazy(() => import('./pages/Agent'));
const FAQ           = lazy(() => import('./pages/FAQ'));
const BillingSuccess = lazy(() => import('./pages/BillingSuccess'));
const Primary       = lazy(() => import('./pages/Primary'));
const Convictions      = lazy(() => import('./pages/Convictions'));
const MarketIndex      = lazy(() => import('./pages/MarketIndex'));
const RoomVisualizer   = lazy(() => import('./pages/RoomVisualizer'));
const AuctionCalendar  = lazy(() => import('./pages/AuctionCalendar'));
const Emerging         = lazy(() => import('./pages/Emerging'));
const VerifyPending    = lazy(() => import('./pages/VerifyPending'));
const Legal                 = lazy(() => import('./pages/Legal'));
const AdminHealth           = lazy(() => import('./pages/AdminHealth'));
const AdminLaunch           = lazy(() => import('./pages/AdminLaunch'));
const AdminRecommendations  = lazy(() => import('./pages/AdminRecommendations'));
const Blog                  = lazy(() => import('./pages/Blog'));
const BlogPost              = lazy(() => import('./pages/BlogPost'));
const FeedbackPage          = lazy(() => import('./pages/FeedbackPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Landing,
  },
  {
    path: '/waitlist',
    loader: () => redirect('/app/signup'),
  },
  {
    path: '/legal/:page',
    Component: Legal,
  },
  {
    path: '/legal',
    Component: Legal,
  },
  // Blog
  { path: '/blog',       Component: Blog     },
  { path: '/blog/:slug', Component: BlogPost },
  // Feedback
  { path: '/feedback', Component: FeedbackPage },
  // Admin dashboards — only camillefroment907@gmail.com
  {
    path: '/nx-ctrl',
    Component: AdminRoute,
    children: [
      { path: 'health',          Component: AdminHealth          },
      { path: 'launch',          Component: AdminLaunch          },
      { path: 'recommendations', Component: AdminRecommendations },
    ],
  },
  // Legacy URL redirects → /legal/*
  { path: '/privacy',  loader: () => redirect('/legal/privacy')    },
  { path: '/terms',    loader: () => redirect('/legal/terms')       },
  { path: '/cookies',  loader: () => redirect('/legal/privacy')     },
  { path: '/pricing',
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
      { path: 'waitlist', loader: () => redirect('/app/signup') },
      { path: 'dashboard', Component: SignalFeed },
      { path: 'explore', Component: Explore },
      { path: 'login', Component: Login },
      { path: 'signup', Component: Signup },
      { path: 'contact', Component: ContactSales },
      { path: 'pricing', Component: Pricing },
      { path: 'opportunities', loader: () => redirect('/app/explore') },
      { path: 'primary', Component: Primary },
      { path: 'convictions', Component: Convictions },
      { path: 'opportunities/:id', Component: OpportunityDetail },
      { path: 'artists', Component: ArtistIntelligence },
      { path: 'artists/:artistName', Component: ArtistIntelligence },
      { path: 'artists-legacy', Component: Artists },
      { path: 'artists-legacy/:id', Component: ArtistDetail },
      { path: 'market', Component: Market },
      { path: 'alerts', Component: Alerts },
      { path: 'portfolio', Component: Portfolio },
      { path: 'agent', Component: Agent },
      { path: 'onboarding', Component: Onboarding },
      { path: 'visualizer', Component: RoomVisualizer },
      { path: 'calendar', Component: AuctionCalendar },
      { path: 'emerging', Component: Emerging },
      { path: 'verify-pending', Component: VerifyPending },
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
