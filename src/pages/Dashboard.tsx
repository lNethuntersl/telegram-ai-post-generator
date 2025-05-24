
import React, { memo } from 'react';
import { DatabaseChannelProvider } from '@/context/DatabaseChannelContext';
import Dashboard from '@/components/Dashboard';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const DashboardPage = () => {
  return (
    <ErrorBoundary fallback={<div className="p-8 text-red-500">Сталася помилка при завантаженні даних. Спробуйте оновити сторінку.</div>}>
      <DatabaseChannelProvider>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b shadow-sm py-4">
            <div className="container mx-auto px-4">
              <h1 className="text-2xl font-bold text-gray-900">Telegram Content Manager 24/7</h1>
              <p className="text-sm text-gray-600 mt-1">Автономний бот з серверним керуванням</p>
            </div>
          </header>
          
          <main className="container mx-auto py-6 px-4">
            <Dashboard />
          </main>
        </div>
        <Toaster />
      </DatabaseChannelProvider>
    </ErrorBoundary>
  );
};

export default DashboardPage;
