import { redirect } from 'next/navigation';

export default function RootPage() {
  // Root redirects to dashboard — the (dashboard) route group handles /dashboard/*
  redirect('/dashboard');
}
