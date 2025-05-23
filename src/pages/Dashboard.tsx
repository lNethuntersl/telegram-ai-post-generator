
import React, { memo } from 'react';
import { ChannelProvider } from '@/context/ChannelContext';
import Dashboard from '@/components/Dashboard';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const DashboardPage = () => {
  return (
    <ErrorBoundary fallback={<div className="p-8 text-red-500">Сталася помилка при завантаженні даних. Спробуйте оновити сторінку.</div>}>
      <ChannelProvider>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b shadow-sm py-4">
            <div className="container mx-auto px-4">
              <h1 className="text-2xl font-bold text-gray-900">Telegram Content Manager</h1>
            </div>
          </header>
          
          <main className="container mx-auto py-6 px-4">
            <Dashboard />
          </main>
        </div>
        <Toaster />
      </ChannelProvider>
    </ErrorBoundary>
  );
};

export default DashboardPage;
