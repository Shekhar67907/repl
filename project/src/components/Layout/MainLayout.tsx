import React from 'react';
import TopMenuBar from './TopMenuBar';
import NavigationButtons from './NavigationButtons';
import { Eye } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-1 border-b border-gray-200">
          <div className="flex items-center">
            <Eye className="h-6 w-6 text-red-600 mr-2" />
            <h1 className="text-xl font-bold text-gray-800">DrishtiRx</h1>
          </div>
        </div>
        <TopMenuBar />
        <NavigationButtons />
      </header>
      
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="w-full max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-3 px-4 text-sm text-gray-600">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          <div className="text-center sm:text-left">
            Drishti - A Complete Optical Retail Management Software
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-500">Powered by modern web technologies</span>
            <a 
              href="https://bolt.new" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-medium rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <span className="mr-1">⚡</span>
              Built with Bolt.new
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;